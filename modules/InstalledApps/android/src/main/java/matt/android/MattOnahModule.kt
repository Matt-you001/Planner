package matt.android

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.content.pm.PackageManager

class MattOnahModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MattOnah")

    Function("getInstalledApps") {
      val context = appContext.reactContext ?: return@Function listOf<Map<String, String>>()
      val pm = context.packageManager
      
      // Get list of installed apps
      val packages = pm.getInstalledPackages(0) 
      val apps = mutableListOf<Map<String, String>>()

      for (packageInfo in packages) {
        try {
            val intent = pm.getLaunchIntentForPackage(packageInfo.packageName)
            if (intent != null) {
                val appName = packageInfo.applicationInfo?.loadLabel(pm)?.toString() ?: packageInfo.packageName
                val packageName = packageInfo.packageName ?: ""
                
                if (packageName.isNotEmpty()) {
                    apps.add(mapOf(
                    "label" to appName,
                    "packageName" to packageName
                    ))
                }
            }
        } catch (e: Exception) {
            continue
        }
      }
      return@Function apps
    }

    Function("launchApp") { packageName: String ->
      val context = appContext.reactContext ?: return@Function false
      val pm = context.packageManager
      try {
        val intent = pm.getLaunchIntentForPackage(packageName)
        if (intent != null) {
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            return@Function true
        }
      } catch (e: Exception) {
         // Log error
      }
      return@Function false
    }
  }
}
