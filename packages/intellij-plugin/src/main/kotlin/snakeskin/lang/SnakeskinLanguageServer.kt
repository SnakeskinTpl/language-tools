package snakeskin.lang

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.project.Project
import com.redhat.devtools.lsp4ij.server.ProcessStreamConnectionProvider
import com.intellij.openapi.application.PluginPathManager
import com.intellij.util.EnvironmentUtil
import com.redhat.devtools.lsp4ij.LanguageServerManager
import java.io.File
import java.nio.file.Paths
import kotlin.io.path.pathString

class SnakeskinLanguageServer(project: Project) : ProcessStreamConnectionProvider() {
    // Inspired by Haskell's IntelliJ plugin
    private fun findExecutableInPATH(executable: String) =
        EnvironmentUtil.getEnvironmentMap().values.flatMap { it.split(File.pathSeparator) }
            .map { File(Paths.get(it, executable).pathString) }.find { it.exists() && it.canExecute() }?.path

    init {
        val nodePath = findExecutableInPATH("node")
        if (nodePath.isNullOrEmpty()) {
            NotificationGroupManager.getInstance().getNotificationGroup("Snakeskin notifications").createNotification(
                "Snakeskin LSP",
                "Node.js executable not found. Make sure it is installed properly (and is available in PATH), and restart the IDE.",
                NotificationType.ERROR
            ).notify(project)
            LanguageServerManager.getInstance(project).stop("snakeskin.lang")
        } else {
            val lspExecPath = PluginPathManager.getPluginResource(this::class.java, "snakeskinLanguageService/main.cjs")?.absolutePath
                ?: throw Exception("Could not find main.cjs")
            val commands: List<String> = mutableListOf(nodePath, lspExecPath, "--stdio")
            super.setCommands(commands)
            super.setWorkingDirectory(project.basePath)
        }
    }
}
