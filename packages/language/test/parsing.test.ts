import { beforeAll, describe, expect, test } from "vitest";
import { EmptyFileSystem, type LangiumDocument } from "langium";
import { expandToString as s } from "langium/generate";
import { parseHelper } from "langium/test";
import type { Module } from "@snakeskin/language";
import { createSnakeskinServices, isModule } from "@snakeskin/language";

let services: ReturnType<typeof createSnakeskinServices>;
let parse:    ReturnType<typeof parseHelper<Module>>;
let document: LangiumDocument<Module> | undefined;

beforeAll(async () => {
    services = createSnakeskinServices(EmptyFileSystem);
    parse = parseHelper<Module>(services.Snakeskin);

    // activate the following if your linking test requires elements from a built-in library, for example
    // await services.shared.workspace.WorkspaceManager.initializeWorkspace([]);
});

describe.skip('Parsing tests', () => {

    test('parse simple model', async () => {
        document = await parse(`
            person Langium
            Hello Langium!
        `);

        // check for absensce of parser errors the classic way:
        //  deacivated, find a much more human readable way below!
        // expect(document.parseResult.parserErrors).toHaveLength(0);

        expect(
            // here we use a (tagged) template expression to create a human readable representation
            //  of the AST part we are interested in and that is to be compared to our expectation;
            // prior to the tagged template expression we check for validity of the parsed document object
            //  by means of the reusable function 'checkDocumentValid()' to sort out (critical) typos first;
            checkDocumentValid(document) || s`
                Persons:
                Greetings to:
            `
        ).toBe(s`
            Persons:
              Langium
            Greetings to:
              Langium
        `);
    });
});

function checkDocumentValid(document: LangiumDocument): string | undefined {
    return document.parseResult.parserErrors.length && s`
        Parser errors:
          ${document.parseResult.parserErrors.map(e => e.message).join('\n  ')}
    `
        || document.parseResult.value === undefined && `ParseResult is 'undefined'.`
        || !isModule(document.parseResult.value) && `Root AST object is a ${document.parseResult.value.$type}, expected a 'Model'.`
        || undefined;
}
