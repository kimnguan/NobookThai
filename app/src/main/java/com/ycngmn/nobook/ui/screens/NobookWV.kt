package com.ycngmn.nobook.ui.screens

import android.content.Intent
import android.util.Log
import android.view.View
import android.webkit.CookieManager
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBars
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalResources
import androidx.core.graphics.ColorUtils
import androidx.core.net.toUri
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.multiplatform.webview.web.LoadingState
import com.multiplatform.webview.web.WebView
import com.multiplatform.webview.web.rememberSaveableWebViewState
import com.multiplatform.webview.web.rememberWebViewNavigator
import com.ycngmn.nobook.R
import com.ycngmn.nobook.ui.components.NetworkErrorDialog
import com.ycngmn.nobook.ui.components.settings.SettingsDialog
import com.ycngmn.nobook.ui.viewmodel.MainViewModel
import com.ycngmn.nobook.ui.viewmodel.SettingsViewModel
import com.ycngmn.nobook.utils.DESKTOP_USER_AGENT
import com.ycngmn.nobook.utils.ExternalRequestInterceptor
import com.ycngmn.nobook.utils.fileChooserWebViewParams
import com.ycngmn.nobook.utils.jsBridge.ClipboardBridge
import com.ycngmn.nobook.utils.jsBridge.DownloadBridge
import com.ycngmn.nobook.utils.jsBridge.NobookSettings
import com.ycngmn.nobook.utils.jsBridge.PhotoViewerBridge
import com.ycngmn.nobook.utils.jsBridge.ShareBridge
import com.ycngmn.nobook.utils.jsBridge.ThemeChange
import com.ycngmn.nobook.utils.jsBridge.VideoPlaybackBridge
import com.ycngmn.nobook.utils.rememberAutoDesktop
import com.ycngmn.nobook.utils.rememberImeHeight
import kotlinx.coroutines.delay

@Composable
fun NobookWebView(
    url: String,
    settingsVM: SettingsViewModel = viewModel()
) {
    val context = LocalContext.current
    val activity = LocalActivity.current
    val resources = LocalResources.current
    val lifecycleOwner = LocalLifecycleOwner.current

    val state = rememberSaveableWebViewState(url)
    val navigator = rememberWebViewNavigator(
        requestInterceptor = ExternalRequestInterceptor { externalUrl ->
            val intent = Intent(Intent.ACTION_VIEW, externalUrl.toUri())
            runCatching {
                context.startActivity(intent)
            }.onFailure {
                Toast.makeText(
                    context,
                    resources.getString(R.string.not_supported),
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    )

    LaunchedEffect(navigator) {
        val bundle = state.viewState
        if (bundle == null) {
            navigator.loadUrl(url)
        }
    }

    // allow exiting while scrolling to top.
    var exitScroll by remember { mutableStateOf(false) }
    BackHandler {
        if (exitScroll) {
            activity?.finish()
        } else {
            navigator.evaluateJavaScript("backHandlerNB();") {
                val backHandled = it.removeSurrounding("\"")
                when (backHandled) {
                    "false" -> {
                        if (navigator.canGoBack) {
                            navigator.navigateBack()
                        } else {
                            activity?.finish()
                        }
                    }
                    "exit" -> activity?.finish()
                    "scrolling" -> exitScroll = true
                }
            }
        }
    }

    LaunchedEffect(exitScroll) {
        if (exitScroll) {
            delay(800)
            exitScroll = false
        }
    }

    val isDesktop by settingsVM.desktopLayout.collectAsState()
    val fontZoom by settingsVM.fontZoom.collectAsState()
    val isAutoRevert by settingsVM.isRevertDesktop.collectAsState()
    val isAutoDesktop = rememberAutoDesktop()

    LaunchedEffect(Unit) {
        if (isAutoDesktop && !isDesktop) {
            settingsVM.setRevertDesktop(true)
            settingsVM.setDesktopLayout(true)
        }
        else if (!isAutoDesktop && isAutoRevert) {
            settingsVM.setRevertDesktop(false)
            settingsVM.setDesktopLayout(false)
        }
    }

    var isLoading by rememberSaveable { mutableStateOf(true) }
    val isError = state.errorsForCurrentRequest.lastOrNull()?.isFromMainFrame == true

    val viewModel: MainViewModel = viewModel {
        MainViewModel(
            resources = resources,
            settings = settingsVM
        )
    }

    val themeColor by viewModel.themeColor
    // Manual handling to fix visual & padding bug on settings dialog.
    var isImmersiveMode by rememberSaveable { mutableStateOf(settingsVM.immersiveMode.value) }

    fun setWindow(immersive: Boolean) {
        val window = activity?.window ?: return
        val windowInsetsController = WindowInsetsControllerCompat(window, window.decorView)

        if (immersive) {
            windowInsetsController.hide(WindowInsetsCompat.Type.systemBars())
            windowInsetsController.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        } else {
            val isLight = ColorUtils.calculateLuminance(themeColor.toArgb()) > 0.5
            windowInsetsController.show(WindowInsetsCompat.Type.systemBars())
            windowInsetsController.isAppearanceLightStatusBars = isLight
            windowInsetsController.isAppearanceLightNavigationBars = isLight
        }
        isImmersiveMode = immersive
    }

    LaunchedEffect(isImmersiveMode, themeColor.value) {
        setWindow(isImmersiveMode)
    }

    val userScripts by viewModel.scripts
    val loadingState = state.loadingState

    LaunchedEffect(loadingState, userScripts) {
        if (loadingState is LoadingState.Finished) {
            userScripts?.let { scripts ->
                navigator.evaluateJavaScript(scripts) {
                    isLoading = false
                }
            }
        }
    }

    if (isError && isLoading) {
        NetworkErrorDialog { activity?.finish() }
        return
    }

    var settingsToggle by rememberSaveable { mutableStateOf(false) }
    if (settingsToggle) {
        setWindow(false)
        SettingsDialog(
            themeColor = themeColor,
            onDismiss = {
                setWindow(settingsVM.immersiveMode.value)
                settingsToggle = false
            },
            onReload = {
                isLoading = true
                viewModel.setThemeColor(Color.Transparent)
                setWindow(settingsVM.immersiveMode.value)
                viewModel.refresh(
                    resources = resources,
                    settings = settingsVM
                )
                navigator.reload()
            }
        )
    }

    if (isLoading) {
        SplashLoading(
            if (loadingState is LoadingState.Loading) {
                loadingState.progress
            } else {
                0.8F
            }
        )
    }


    var nativeWebView by remember { mutableStateOf<android.webkit.WebView?>(null) }

    LaunchedEffect(isDesktop, nativeWebView) {
        val userAgent = if (isDesktop) DESKTOP_USER_AGENT else ""
        nativeWebView?.settings?.userAgentString = userAgent
    }

    LaunchedEffect(nativeWebView, fontZoom) {
        val webView = nativeWebView ?: return@LaunchedEffect
        webView.settings.textZoom = fontZoom
        webView.evaluateJavascript(
            "window.__nobookFontZoom=$fontZoom;window.__nobookApplyFontZoomCompat?.($fontZoom);",
            null
        )
    }

    DisposableEffect(lifecycleOwner, nativeWebView) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> {
                    Log.d("NobookVideoWake", "Lifecycle ON_RESUME")
                }
                Lifecycle.Event.ON_PAUSE -> {
                    nativeWebView?.keepScreenOn = false
                    Log.d(
                        "NobookVideoWake",
                        "Lifecycle ON_PAUSE; keepScreenOn=${nativeWebView?.keepScreenOn}"
                    )
                }
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            nativeWebView?.keepScreenOn = false
        }
    }

    // needed to consume extra padding when keyboard is open
    val density = LocalDensity.current
    val barsInsets = WindowInsets.systemBars.asPaddingValues()
    val imeHeight = rememberImeHeight()
    val photoViewerOpen = remember { mutableStateOf(false) }
    val appliedIme = if (photoViewerOpen.value) 0.dp else imeHeight
    val shareBridge = remember(context) { ShareBridge(context) }

    LaunchedEffect(appliedIme, imeHeight, nativeWebView) {
        val webView = nativeWebView ?: return@LaunchedEffect
        val appliedPx = with(density) { appliedIme.roundToPx() }
        val rawPx = with(density) { imeHeight.roundToPx() }
        webView.evaluateJavascript(
            "window.__nobookImeBottomPx=$appliedPx;window.__nobookImeRawPx=$rawPx;",
            null
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(themeColor)
            .then(
                if (isImmersiveMode) {
                    Modifier.padding(bottom = appliedIme)
                } else {
                    Modifier.padding(
                        top = barsInsets.calculateTopPadding(),
                        bottom = maxOf(barsInsets.calculateBottomPadding(), appliedIme)
                    )
                }
            )
    ) {
    WebView(
        modifier = Modifier
            .weight(1f)
            .fillMaxWidth()
            .background(themeColor),
        state = state,
        navigator = navigator,
        platformWebViewParams = fileChooserWebViewParams(),
        captureBackPresses = false,
        onCreated = { webView ->
            nativeWebView = webView

            val cookieManager = CookieManager.getInstance()
            cookieManager.setAcceptCookie(true)
            cookieManager.setAcceptThirdPartyCookies(webView, true)
            cookieManager.flush()

            state.webSettings.apply {
                isJavaScriptEnabled = true

                androidWebSettings.apply {
                    //isDebugInspectorInfoEnabled = true
                    domStorageEnabled = true
                    hideDefaultVideoPoster = true
                    mediaPlaybackRequiresUserGesture = false
                }
            }

            webView.apply {
                addJavascriptInterface(
                    NobookSettings { settingsToggle = true },
                    "SettingsBridge"
                )
                addJavascriptInterface(
                    ThemeChange { viewModel.setThemeColor(Color(it)) },
                    "ThemeBridge"
                )
                addJavascriptInterface(
                    DownloadBridge(context),
                    "DownloadBridge"
                )
                addJavascriptInterface(
                    ClipboardBridge(context),
                    "ClipboardBridge"
                )
                addJavascriptInterface(
                    shareBridge,
                    "ShareBridge"
                )
                addJavascriptInterface(
                    PhotoViewerBridge { open ->
                        post { photoViewerOpen.value = open }
                    },
                    "PhotoViewerBridge"
                )
                addJavascriptInterface(
                    VideoPlaybackBridge { isPlaying ->
                        Log.d("NobookVideoWake", "Bridge callback active=$isPlaying")
                        post {
                            keepScreenOn = isPlaying
                            Log.d(
                                "NobookVideoWake",
                                "Bridge applied active=$isPlaying; keepScreenOn=$keepScreenOn"
                            )
                        }
                    },
                    "VideoPlaybackBridge"
                )

                setLayerType(View.LAYER_TYPE_HARDWARE, null)

                overScrollMode = View.OVER_SCROLL_NEVER
                isVerticalScrollBarEnabled = false
                isHorizontalScrollBarEnabled = false

                settings.setSupportZoom(true)
                settings.builtInZoomControls = true
                settings.displayZoomControls = false
            }
        }
    )
    }
}
