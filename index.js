import { OpenAI } from 'openai';
import { executeCommand } from './tools/exec.js';
import { fetchAndSaveHtml, fetchAndSaveStyles } from './tools/clone.js';
import { SYSTEM_PROMPT } from './system-prompt.js';

let TOOL_MAP = {
  executeCommand,
  fetchAndSaveHtml,
  fetchAndSaveStyles,
};

let client = new OpenAI();

async function main() {
  let args = process.argv.slice(2)
  if (args.length === 0) {
    console.error('site url missing');
    process.exit(1);
  }
  let siteUrl = args[0];

  let messages = [
    { role: 'system', content: SYSTEM_PROMPT, },
    {
      role: 'user',
      content: `
        - site: '${siteUrl}'
        - make clone of above site.
      `,
    },
  ];

  while (true) {
    let response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages,
    });

    let rawContent = response.choices[0].message.content;
    let parsedContent = JSON.parse(rawContent);

    messages.push({
      role: 'assistant',
      content: JSON.stringify(parsedContent),
    });

    if (parsedContent.step === 'START') {
      console.log(`🔥`, parsedContent.content);
      continue;
    }

    if (parsedContent.step === 'THINK') {
      console.log(`\t🧠`, parsedContent.content);
      continue;
    }

    if (parsedContent.step === 'TOOL') {
      let toolToCall = parsedContent.tool_name;
      if (!TOOL_MAP[toolToCall]) {
        messages.push({
          role: 'developer',
          content: `There is no such tool as ${toolToCall}`,
        });
        continue;
      }

      let responseFromTool = await TOOL_MAP[toolToCall](parsedContent.input);
      console.log(
        `🛠️: ${toolToCall}(${parsedContent.input}) = `,
        responseFromTool
      );
      messages.push({
        role: 'developer',
        content: JSON.stringify({ step: 'OBSERVE', content: responseFromTool }),
      });
      continue;
    }

    if (parsedContent.step === 'OUTPUT') {
      console.log(`🟡`, parsedContent.content);
      break;
    }
  }

  console.log('Done...');
}

main();
