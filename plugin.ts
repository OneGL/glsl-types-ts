import fs from "fs/promises";
import path from "path";
import { Plugin } from "vite";
import includePluginGLSL from "vite-plugin-glsl";
import { parser } from "@shaderfrog/glsl-parser";
import { visit } from "@shaderfrog/glsl-parser/ast";

const preLen = "var test_default = ".length;
const postLen = ";\nexport {\n  test_default as default\n};\n".length;

type ShaderType = "vertex" | "fragment";

function getShaderType(id: string): ShaderType | null {
  if (id.endsWith(".vert")) {
    return "vertex";
  }

  if (id.endsWith(".frag")) {
    return "fragment";
  }

  return null;
}

type Config = {
  inputFolder: string;
};

const DEFAULT_CONFIG: Config = {
  inputFolder: "shaders",
};

export default function customSyntaxPlugin(config?: Partial<Config>): Plugin {
  const { inputFolder } = { ...DEFAULT_CONFIG, ...config };
  const glslPlugin = includePluginGLSL();
  const absoluteInputFolder = path.resolve(inputFolder);
  const shadersFolder = path.resolve(absoluteInputFolder);
  const shadersTypesFolder = path.resolve(shadersFolder, "__types");

  return {
    name: "vite-plugin-custom-syntax",

    config: () => ({
      resolve: {
        alias: {
          "@shaders": shadersFolder,
        },
      },
    }),

    async transform(code, id) {
      const shaderType = getShaderType(id);

      if (shaderType) {
        // @ts-ignore
        let parsedContent = (await glslPlugin.transform(code, id)).code;
        parsedContent = parsedContent.slice(preLen, parsedContent.length - postLen);
        parsedContent = JSON.parse(parsedContent);

        // Remove the absoluteInputFolder from the id
        const relativeId = path.relative(absoluteInputFolder, id);
        
        const dtsFilePath = path.resolve(shadersTypesFolder, `${relativeId}.d.ts`);
        const relativeFilePath = path.relative(absoluteInputFolder, id);
        const dtsContent = generateTypeDefinitions(parsedContent, shaderType, relativeFilePath);

        await fs.mkdir(path.dirname(dtsFilePath), { recursive: true });
        await fs.writeFile(dtsFilePath, dtsContent);

        parsedContent = `const value = \`${parsedContent}\`;\nexport default value;`;

        return {
          code: parsedContent,
          map: null,
        };
      }
      return null;
    },
  };
}

function generateTypeDefinitions(parsedContent: string, shaderType: ShaderType, relativeFilePath: string) {
  let typeDefs = `declare module "@shaders/${relativeFilePath}" {\n`;
  typeDefs += `const value: {\n`;

  const { uniforms, ins, outs } = extractUniformsInsAndOuts(parsedContent);
  typeDefs += `  uniforms: {\n`;
  for (const { name, type } of uniforms) {
    typeDefs += `    ${name}: \"${type}\";\n`;
  }
  typeDefs += `  };\n`;
  typeDefs += `  ins: {\n`;
  for (const { name, type } of ins) {
    typeDefs += `    ${name}: \"${type}\";\n`;
  }
  typeDefs += `  };\n`;
  typeDefs += `  outs: {\n`;
  for (const { name, type } of outs) {
    typeDefs += `    ${name}: \"${type}\";\n`;
  }
  typeDefs += `  };\n`;
  typeDefs += `  type: \"${shaderType}\";\n`;
  typeDefs += `  source: /* glsl */ \`${parsedContent}\`\n`;
  typeDefs += `};\nexport default value;\n`;
  typeDefs += `}\n`;
  return typeDefs;
}

type NameAndType = {
  name: string;
  type: string;
};

function extractUniformsInsAndOuts(code: string): {
  uniforms: NameAndType[];
  ins: NameAndType[];
  outs: NameAndType[];
} {
  const uniforms: NameAndType[] = [];
  const ins: NameAndType[] = [];
  const outs: NameAndType[] = [];
  const ast = parser.parse(code);

  visit(ast, {
    declaration: {
      enter(path) {
        const node = path.node;
        const parent = path.parent;
        const name = node.identifier.identifier;

        if (parent && parent.type === "declarator_list") {
          if ("token" in parent.specified_type.specifier.specifier) {
            const type = parent.specified_type.specifier.specifier.token;
            const qualifiers = parent.specified_type.qualifiers;

            if (!qualifiers) {
              return;
            }

            for (const qualifier of qualifiers) {
              if (qualifier.type != "keyword") {
                continue;
              }

              if (qualifier.token === "in") {
                ins.push({ name, type });
                return;
              }

              if (qualifier.token === "out") {
                outs.push({ name, type });
                return;
              }

              if (qualifier.token === "uniform") {
                uniforms.push({ name, type });
                return;
              }
            }
          }
        }
      },
    },
  });

  return { uniforms, ins, outs };
}
