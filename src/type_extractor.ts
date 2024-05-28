import path from "path";
import fs from "fs/promises";
import { parser } from "@shaderfrog/glsl-parser";
import { visit } from "@shaderfrog/glsl-parser/ast";

export async function generateTypesFile({
  content: source,
  glslFilePath,
  outputPath,
  shaderType,
}: {
  content: string;
  glslFilePath: string;
  outputPath: string;
  shaderType: ShaderType;
}) {
  const typesFile = generateTypeDefinitions({
    source,
    shaderType,
    glslFilePath,
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, typesFile);
}

function generateTypeDefinitions({
  source,
  shaderType,
  glslFilePath,
}: {
  source: string;
  shaderType: ShaderType;
  glslFilePath: string;
}) {
  const { uniforms, ins, outs } = extractUniformsInsAndOuts(source);

  return `
declare module "@shaders/${glslFilePath}" {
  const value: {
    uniforms: {
${uniforms.map(({ name, type }) => `      ${name}: "${type}";`).join("\n")}
    };
    ins: {
${ins.map(({ name, type }) => `      ${name}: "${type}";`).join("\n")}
    };
    outs: {
${outs.map(({ name, type }) => `      ${name}: "${type}";`).join("\n")}
    };
    type: "${shaderType}";
    source: /* glsl */ \`${source}\`
  };
  export default value;
}`;
}

type NameAndType = {
  name: string;
  type: string;
};

function extractUniformsInsAndOuts(source: string): {
  uniforms: NameAndType[];
  ins: NameAndType[];
  outs: NameAndType[];
} {
  const uniforms: NameAndType[] = [];
  const ins: NameAndType[] = [];
  const outs: NameAndType[] = [];
  const ast = parser.parse(source);

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

const VERTEX_SHADER_EXTENSIONS = [".vert", ".vs"];
const FRAGMENT_SHADER_EXTENSIONS = [".frag", ".fs"];

type ShaderType = "vertex" | "fragment";

export function getShaderType(id: string): ShaderType | null {
  const extension = path.extname(id);

  if (VERTEX_SHADER_EXTENSIONS.includes(extension)) {
    return "vertex";
  }

  if (FRAGMENT_SHADER_EXTENSIONS.includes(extension)) {
    return "fragment";
  }

  return null;
}
