package snakeskin.lang

import com.intellij.openapi.project.Project
import com.redhat.devtools.lsp4ij.server.ProcessStreamConnectionProvider
import com.intellij.openapi.application.PluginPathManager

class SnakeskinLanguageServer(project: Project) : ProcessStreamConnectionProvider() {
    init {
        val path = PluginPathManager.getPluginResource(this::class.java, "snakeskinLanguageService/main.cjs")?.absolutePath
            ?: throw Exception("Could not find main.cjs")
        val commands: List<String> = mutableListOf("node", path, "--stdio")
        super.setCommands(commands)
    }
}
