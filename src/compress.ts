// This function was taken from vite-plugin-glsl:
// https://github.com/UstymUkhman/vite-plugin-glsl/blob/main/src/loadShader.js#L199

/**
 * @function
 * @name compressShader
 * @description Compresses shader source code by
 * removing unnecessary whitespace and empty lines
 *
 * @param {string}  shader  Shader code with included chunks
 * @param {boolean} newLine Flag to require a new line for the code
 *
 * @returns {string} Compressed shader's source code
 */
export function compressShader(shader: string, newLine: boolean = false) {
  return shader
    .replace(/\\(?:\r\n|\n\r|\n|\r)|\/\*.*?\*\/|\/\/(?:\\(?:\r\n|\n\r|\n|\r)|[^\n\r])*/g, "")
    .split(/\n+/)
    .reduce((result: string[], line: string) => {
      line = line.trim().replace(/\s{2,}|\t/, " ");

      if (/@(vertex|fragment)/.test(line) || line.endsWith("return")) line += " ";

      if (line[0] === "#") {
        newLine && result.push("\n");
        result.push(line, "\n");
        newLine = false;
      } else {
        !line.startsWith("{") && result.length && result[result.length - 1].endsWith("else") && result.push(" ");
        result.push(line.replace(/\s*({|}|=|\*|,|\+|\/|>|<|&|\||\[|\]|\(|\)|\-|!|;)\s*/g, "$1"));
        newLine = true;
      }

      return result;
    }, [])
    .join("")
    .replace(/\n+/g, "\n");
}
