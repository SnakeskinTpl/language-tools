package snakeskin.lang

import com.intellij.openapi.application.PluginPathManager
import org.jetbrains.plugins.textmate.api.TextMateBundleProvider
import org.jetbrains.plugins.textmate.api.TextMateBundleProvider.PluginBundle

// Inspired by https://github.com/usebruno/bruno-ide-extensions/pull/11
class SnakeskinTextMateBundleProvider : TextMateBundleProvider {
    override fun getBundles(): List<PluginBundle> {
        val textmateDir = PluginPathManager.getPluginResource(this::class.java, "textmate") ?: return emptyList()
        val path = textmateDir.toPath()
        return listOf(PluginBundle("Snakeskin", path))
    }
}
