import { OpenAI } from 'openai';
import { exec } from 'child_process';

import fs from 'fs';

let TOOL_MAP = {
  executeCommand,
  fetchAndSaveHtml,
  fetchAndSaveStyles,
};

let client = new OpenAI();

async function main() {
  let SYSTEM_PROMPT = `
    You are an AI assistant who works on START, THINK and OUTPUT format.
    For a given user query first think and breakdown the problem into sub problems.
    You should always keep thinking and thinking before giving the actual output.

    Also, before outputing the final result to user you must check once if everything is correct.
    You also have list of available tools that you can call based on user query.

    For every tool call that you make, wait for the OBSERVATION from the tool which is the response from the tool that you called.

    Available Tools:
    - executeCommand(command: string): Takes a linux / unix command as arg and executes the command on user's machine and returns the output
    - fetchAndSaveHtml(url: string): curls the given site, and saves the response into a file
    - fetchAndSaveStyles(url: string): gets all the styles associated with the site

    Rules:
    - Strictly follow the output JSON format
    - Always follow the output in sequence that is START, THINK, OBSERVE and OUTPUT.
    - Always perform only one step at a time and wait for other step.
    - Alway make sure to do multiple steps of thinking before giving out output.
    - For every tool call always wait for the OBSERVE which contains the output from tool

    Output JSON Format:
    { "step": "START | THINK | OUTPUT | OBSERVE | TOOL" , "content": "string", "tool_name": "string", "input": "STRING" }

    Example:
    User: make clone of https://google.com
    ASSISTANT: { "step": "START", "content": "The user wants to clone the given site" }
    ASSISTANT: { "step": "THINK", "content": "Let me see if there is any available tool for this query" }
    ASSISTANT: { "step": "THINK", "content": "I see that there is a tool available that fetches data for a site" }
    ASSISTANT: { "step": "THINK", "content": "I need to call fetchAndSaveHtml for given url" }
    ASSISTANT: { "step": "TOOL", "input": "https://google.com", "tool_name": "fetchAndSaveHtml" }
    DEVELOPER: { "step": "OBSERVE", "content": "Website content is fetched and saved into a local file." }
    ASSISTANT: { "step": "THINK", "content": "Great, I got the website details for the site." }
    ASSISTANT: { "step": "OUTPUT", "content": "Website cloned successfully." }
  `;

  let messages = [
    { role: 'system', content: SYSTEM_PROMPT, },
    {
      role: 'user',
      content: `
        - site: 'https://www.google.com'
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

// ===========

async function executeCommand(cmd = '') {
  return new Promise((res, rej) => {
    exec(cmd, (error, data) => {
      if (error) {
        return res(`Error running command ${error}`);
      } else {
        res(data);
      }
    });
  });
}

async function fetchAndSaveHtml(url = '') {
  let response = await fetch(url)
  let data = await response.text()

  fs.writeFileSync('clone.html', data)

  return 'HTML data fetched.'
}

async function fetchAndSaveStyles(url = '') {
  try {
    let html = fs.readFileSync('clone.html', 'utf8');

    fs.mkdirSync('assets', { recursive: true });

    let styleLinks = html.match(/<link[^>]*?rel="stylesheet"[^>]*?href="(.*?)"[^>]*?>/g) || []

    for (let link of styleLinks) {
      let styleUrl = link.match(/href="(.*?)"/)[1];
      let fullUrl = styleUrl.startsWith('http') ? styleUrl : new URL(styleUrl, url).href;

      try {
        let css = await (await fetch(fullUrl)).text();
        let localPath = `assets/style-${Date.now()}.css`;
        fs.writeFileSync(localPath, css);

        html = html.replace(link, `<link rel="stylesheet" href="${localPath}">`);
      } catch (err) {
        console.log(`Skipping ${fullUrl}:`, err.message);
      }
    }

    fs.writeFileSync('clone.html', html);
    return 'Styles saved successfully';

  } catch (error) {
    return `Error: ${error.message}`;
  }
}
