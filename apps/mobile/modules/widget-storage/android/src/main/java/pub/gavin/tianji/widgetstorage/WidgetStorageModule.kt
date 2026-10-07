package pub.gavin.tianji.widgetstorage

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// DESIGN-GAP: A tiny local Expo module provides Android SharedPreferences access for
// the versioned, presentation-only snapshot. Birth records remain in SQLCipher.
class WidgetStorageModule : Module() {
  private fun preferences() = requireNotNull(appContext.reactContext)
    .getSharedPreferences("tianji.widget.v1", Context.MODE_PRIVATE)

  override fun definition() = ModuleDefinition {
    Name("TianjiWidgetStorage")
    AsyncFunction("read") { preferences().getString("snapshot", null) }
    AsyncFunction("write") { snapshot: String ->
      check(preferences().edit().putString("snapshot", snapshot).commit())
    }
    AsyncFunction("clear") { check(preferences().edit().clear().commit()) }
  }
}
