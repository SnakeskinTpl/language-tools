package snakeskin.lang

import com.intellij.openapi.fileTypes.LanguageFileType
import javax.swing.Icon

object SnakeskinFileType : LanguageFileType(SnakeskinLanguage.INSTANCE) {
    val INSTANCE = SnakeskinFileType

    override fun getName(): String = "Snakeskin"

    override fun getDescription(): String = "Snakeskin language file"

    override fun getDefaultExtension(): String = "ss"

    override fun getIcon(): Icon = SnakeskinIcons.Logo
}
