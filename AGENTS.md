# Android App – Cursor Project Rules

## Project Overview
- App name: **Nobook**. Package ID: `com.ycngmn.nobook`.
- Native Android app built with **Kotlin** and **Jetpack Compose** (Material 3).
- Nobook is a lightweight Facebook browser (WebView) with ad blocking, feed tweaks, and media download.
- Goal: produce a signed, installable **APK** (debug for testing, release/AAB for distribution).
- Current versions: `minSdk` 23, `compileSdk` / `targetSdk` 36, `versionName` `0.1.1`. Debug builds use `applicationIdSuffix` `.test`.

## Tech Stack
Use what the project already depends on. Ask before adding a library or architecture layer that is not listed here.

- Language: Kotlin, coroutines + Flow
- UI: Jetpack Compose, Material 3
- Architecture: MVVM, unidirectional data flow (ViewModels in `ui/viewmodel`)
- Local storage: DataStore (preferences)
- Networking: Ktor client + OkHttp engine
- Web content: Compose Multiplatform WebView, injected scripts in `res/raw`, JS bridges in `utils/jsBridge`
- Build: Gradle Kotlin DSL (`build.gradle.kts`) with version catalog (`gradle/libs.versions.toml`)
- Tests: JUnit 4. Compose UI test and Espresso are on the classpath. Some unit tests use Playwright.

Not in this project today: Hilt, Room, Retrofit, Navigation Compose, Coil, kotlinx.serialization. Do not introduce them unless asked.

## Project Structure
```
app/src/main/java/com/ycngmn/nobook/
├── data/
│   └── local/              # DataStore and other local settings
├── ui/
│   ├── components/         # Reusable composables (settings, etc.)
│   ├── screens/            # Screen composables
│   ├── theme/              # Color, Type, Theme
│   └── viewmodel/          # ViewModels
└── utils/                  # WebView helpers, file picker, JS bridges
    └── jsBridge/
```

Resources: `app/src/main/res/` (`values/strings.xml`, `raw/` scripts). Unit tests live in `app/src/test/`.

## Coding Conventions
- Follow the official Kotlin style guide; 4-space indent; max line length 120.
- One screen = `XScreen.kt` (composable), `XViewModel.kt`, `XUiState.kt`.
- Composables: PascalCase, stateless where possible, hoist state, accept `modifier: Modifier = Modifier` as the first optional parameter.
- ViewModels expose `StateFlow<UiState>`; never expose `MutableStateFlow`.
- Use `collectAsStateWithLifecycle()` in composables.
- No business logic in composables or Activities.
- Prefer immutable `data class` and `sealed interface` for state/events.
- Never block the main thread; use `Dispatchers.IO` for disk/network via repositories or existing data helpers.
- No hardcoded strings: use `strings.xml`. Support Thai and English from the start (`values/` and `values-th/`).
- No hardcoded colors/dimensions in screens; use theme tokens.
- Keep code and comments in English; UI strings in both English and Thai.

## Security & Config
- Never commit secrets, API keys, or keystores. Use `local.properties` / `gradle.properties` (gitignored) and `BuildConfig` fields.
- Keystore files (`*.jks`, `*.keystore`) and `keystore.properties` must be in `.gitignore`.
- HTTPS only; no cleartext traffic.
- Request the minimum permissions; use runtime permission flow for dangerous ones.
- Enable R8/ProGuard for release builds and keep rules in `proguard-rules.pro`. Release minify and resource shrinking are already on.

## Build & Run Commands
On Windows, use `gradlew.bat` instead of `./gradlew`.

```bash
./gradlew assembleDebug        # app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease      # signed release APK (needs signing config)
./gradlew bundleRelease        # AAB for Play Store
./gradlew installDebug         # install on connected device/emulator
./gradlew test                 # unit tests
./gradlew connectedAndroidTest # instrumented tests
./gradlew lint ktlintCheck     # static checks
```

## Release Signing (outline)
1. Generate keystore once: `keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias release`
2. Store credentials in `keystore.properties` (gitignored).
3. Load them in `app/build.gradle.kts` under `signingConfigs { create("release") { ... } }`.
4. Back up the keystore securely; losing it means you cannot update the app.

## Testing
- Unit tests: JUnit + kotlinx-coroutines-test when Flow timing matters. Add MockK or Turbine only if asked.
- UI tests: Compose UI test (`createComposeRule`).
- Every ViewModel and repository gets unit tests; test state transitions, not implementation.
- Script and layout behavior that is pure Kotlin/JS string logic belongs in `app/src/test`.

## Workflow Rules for the AI
- Before large changes, outline the plan and list files to be touched.
- Make small, reviewable changes; keep the project compiling after each step.
- When adding a dependency, add it to `libs.versions.toml` first, then reference via `libs.*`.
- Do not modify Gradle plugin/SDK versions unless asked.
- After edits, tell me which Gradle command to run to verify.
- When a build error appears, fix the root cause; do not suppress warnings or lint to make it pass.
- Ask before introducing new architecture layers, libraries, or permissions.
- Do not add layout or UI elements that were not requested, and do not restyle areas outside the change.

## Definition of Done (per feature)
- [ ] Compiles with `assembleDebug`
- [ ] No new lint/ktlint errors
- [ ] Unit tests added/updated
- [ ] Strings extracted (EN + TH)
- [ ] Tested on at least one emulator/device (portrait + dark mode)
