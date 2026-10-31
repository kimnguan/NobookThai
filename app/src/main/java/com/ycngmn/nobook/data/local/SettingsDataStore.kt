package com.ycngmn.nobook.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "nobook_prefs")

class SettingsDataStore(private val context: Context) {
    companion object {
        val REMOVE_ADS = booleanPreferencesKey("remove_ads")
        val ENABLE_DOWNLOAD_CONTENT = booleanPreferencesKey("enable_download_content")
        val ENABLE_COPY_TO_CLIPBOARD = booleanPreferencesKey("enable_copy_to_clipboard")
        val DESKTOP_LAYOUT = booleanPreferencesKey("desktop_layout")
        val IMMERSIVE_MODE = booleanPreferencesKey("immersive_mode")
        val STICKY_NAVBAR = booleanPreferencesKey("sticky_navbar")
        val PINCH_TO_ZOOM = booleanPreferencesKey("pinch_to_zoom")
        val FONT_ZOOM = intPreferencesKey("font_zoom")
        val AMOLED_BLACK = booleanPreferencesKey("amoled_black")
        val HIDE_SUGGESTED = booleanPreferencesKey("hide_suggestion")
        val HIDE_AI_CONTENT = booleanPreferencesKey("hide_ai_content")
        val HIDE_REELS = booleanPreferencesKey("hide_reels")
        val HIDE_STORIES = booleanPreferencesKey("hide_stories")
        val HIDE_PEOPLE_YOU_MAY_KNOW = booleanPreferencesKey("hide_people_you_may_know")
        val HIDE_GROUPS = booleanPreferencesKey("hide_groups")
        val isRevertDesktop = booleanPreferencesKey("is_revert_desktop")
    }

    val prefs = context.dataStore.data

    val revertDesktop = context.dataStore.data.map { it[isRevertDesktop] ?: false }
    suspend fun setRevertDesktop(revertDesktop: Boolean) {
        context.dataStore.edit { it[isRevertDesktop] = revertDesktop }
    }

    val removeAds = context.dataStore.data.map { it[REMOVE_ADS] ?: true }
    suspend fun setRemoveAds(removeAds: Boolean) {
        context.dataStore.edit { it[REMOVE_ADS] = removeAds }
    }

    val enableDownloadContent = context.dataStore.data.map { it[ENABLE_DOWNLOAD_CONTENT] ?: false }
    suspend fun setEnableDownloadContent(enableDownloadContent: Boolean) {
        context.dataStore.edit { it[ENABLE_DOWNLOAD_CONTENT] = enableDownloadContent }
    }

    val enableCopyToClipboard = context.dataStore.data.map { it[ENABLE_COPY_TO_CLIPBOARD] ?: false }
    suspend fun setEnableCopyToClipboard(enableCopyToClipboard: Boolean) {
        context.dataStore.edit { it[ENABLE_COPY_TO_CLIPBOARD] = enableCopyToClipboard }
    }

    val desktopLayout = context.dataStore.data.map { it[DESKTOP_LAYOUT] ?: false }
    suspend fun setDesktopLayout(desktopLayout: Boolean) {
        context.dataStore.edit { it[DESKTOP_LAYOUT] = desktopLayout }
    }

    val immersiveMode = context.dataStore.data.map { it[IMMERSIVE_MODE] ?: false}
    suspend fun setImmersiveMode(immersiveMode: Boolean) {
        context.dataStore.edit { it[IMMERSIVE_MODE] = immersiveMode }
    }

    val stickyNavbar = context.dataStore.data.map { it[STICKY_NAVBAR] ?: true }
    suspend fun setStickyNavbar(stickyNavbar: Boolean) {
        context.dataStore.edit { it[STICKY_NAVBAR] = stickyNavbar }
    }

    val pinchToZoom = context.dataStore.data.map { it[PINCH_TO_ZOOM] ?: false }
    suspend fun setPinchToZoom(pinchToZoom: Boolean) {
        context.dataStore.edit { it[PINCH_TO_ZOOM] = pinchToZoom }
    }

    val fontZoom = context.dataStore.data.map { it[FONT_ZOOM] ?: 100 }
    suspend fun setFontZoom(fontZoom: Int) {
        require(fontZoom in setOf(85, 100, 115, 130, 145))
        context.dataStore.edit { it[FONT_ZOOM] = fontZoom }
    }

    val amoledBlack = context.dataStore.data.map { it[AMOLED_BLACK] ?: false }
    suspend fun setAmoledBlack(amoledBlack: Boolean) {
        context.dataStore.edit { it[AMOLED_BLACK] = amoledBlack }
    }

    val hideSuggested = context.dataStore.data.map { it[HIDE_SUGGESTED] ?: false }
    suspend fun setHideSuggested(hideSuggestion: Boolean) {
        context.dataStore.edit { it[HIDE_SUGGESTED] = hideSuggestion }
    }

    val hideAiContent = context.dataStore.data.map { it[HIDE_AI_CONTENT] ?: false }
    suspend fun setHideAiContent(hideAiContent: Boolean) {
        context.dataStore.edit { it[HIDE_AI_CONTENT] = hideAiContent }
    }

    val hideReels = context.dataStore.data.map { it[HIDE_REELS] ?: false }
    suspend fun setHideReels(hideReels: Boolean) {
        context.dataStore.edit { it[HIDE_REELS] = hideReels }
    }

    val hideStories = context.dataStore.data.map { it[HIDE_STORIES] ?: false }
    suspend fun setHideStories(hideStories: Boolean) {
        context.dataStore.edit { it[HIDE_STORIES] = hideStories }
    }

    val hidePeopleYouMayKnow = context.dataStore.data.map { it[HIDE_PEOPLE_YOU_MAY_KNOW] ?: false }
    suspend fun setHidePeopleYouMayKnow(hidePeopleYouMayKnow: Boolean) {
        context.dataStore.edit { it[HIDE_PEOPLE_YOU_MAY_KNOW] = hidePeopleYouMayKnow }
    }

    val hideGroups = context.dataStore.data.map { it[HIDE_GROUPS] ?: false }
    suspend fun setHideGroups(hideGroups: Boolean) {
        context.dataStore.edit { it[HIDE_GROUPS] = hideGroups }
    }
}
