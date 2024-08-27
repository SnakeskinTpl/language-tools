import { MonacoEditorLanguageClientWrapper, UserConfig } from 'monaco-editor-wrapper';
import { configureWorker, defineUserServices } from './setupCommon.js';
import { monarchSyntax } from 'snakeskin-language';

export const setupConfigClassic = (): UserConfig => {
    return {
        wrapperConfig: {
            serviceConfig: defineUserServices(),
            editorAppConfig: {
                $type: 'classic',
                codeResources: {
                    main: {
                        text: '/// Snakeskin is running in the web!',
                        fileExt: 'ss',
                        enforceLanguageId: 'snakeskin'
                    }
                },
                languageDef: {
                    languageExtensionConfig: { id: 'snakeskin' },
                    monarchLanguage: monarchSyntax
                },
                editorOptions: {
                    'semanticHighlighting.enabled': true,
                    theme: 'vs-dark'
                }
            }
        },
        languageClientConfig: configureWorker()
    };
};

export const executeClassic = async (htmlElement: HTMLElement) => {
    const userConfig = setupConfigClassic();
    const wrapper = new MonacoEditorLanguageClientWrapper();
    await wrapper.initAndStart(userConfig, htmlElement);
};
