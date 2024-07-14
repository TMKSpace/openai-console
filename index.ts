import openai from "openai";
import fs from "fs";
import readline from "readline";
import "colors";

console.clear();
console.log("Loading...".yellow);

class Config {
  api = {
    apiKey: "Key"
  } as { apiKey: string; baseURL?: string };
  ai = {
    model: "gpt-3.5-turbo",
    temperature: 1
  };
  chat = {
    chatHistoryPath: "chathistory.json"
  };

  static checkoutConfig(config: Config) {
    const entries = Object.entries(config);
    const newConfig = new this();
    this.checkoutEntries(entries, newConfig);
    console.log(newConfig);
    return newConfig;
  }

  private static checkoutEntries(
    entries: [key: string, object: any][],
    linkedObject: any
  ) {
    console.log(linkedObject);
    for (let [key, object] of entries) {
      if (typeof object == "object") {
        this.checkoutEntries(Object.entries(object), linkedObject[key]);
      } else if (linkedObject != undefined) {
        const ignoredKeys = ["baseURL"];
        key =
          linkedObject[key] ||
          key.startsWith("deprecated_") ||
          ignoredKeys.includes(key)
            ? key
            : "deprecated_" + key;

        linkedObject[key] = object;
      }
    }
  }
}

function readConfig() {
  let config: Config;
  if (fs.existsSync("./config.json")) {
    config = JSON.parse(fs.readFileSync("./config.json").toString()) as Config;
    config = Config.checkoutConfig(config);
  } else config = new Config();
  fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));
  return config;
}

const cfg = readConfig();

const rl = readline.createInterface(process.stdin, process.stdout);

if (!cfg.api.baseURL) delete cfg.api.baseURL;
const ai = new openai.OpenAI(cfg.api);

type Message = {
  content: string;
  role: string;
};
type Messages = {
  messages: Message[];
};

// Restore chat from save.

const messages: Message[] = [];
if (fs.existsSync("./chathistory.json")) {
  const oldMessages = JSON.parse(
    fs.readFileSync(cfg.chat.chatHistoryPath).toString()
  ) as Messages;
  messages.push(...oldMessages.messages);
  oldMessages.messages.forEach((message) => {
    const rolemsg = message.role + ":";
    console.log(message.role == "user" ? rolemsg.cyan : rolemsg.red);
    console.log(message.content.gray);
  });
  console.log("\n");
}

// Main chat function

async function main() {
  const response = await ai.chat.completions
    .create({
      model: cfg.ai.model,
      messages: messages as [],
      temperature: cfg.ai.temperature,
      n: 1,
      stream: true
    })
    .catch(console.log);
  if (!response) return;

  let temp: Message = { role: "assistant", content: "" };
  for await (let part of response) {
    const data = part.choices[0].delta;
    if (part.choices[0].finish_reason) {
      messages.push(temp);
      console.log("\nuser:".cyan);
      return saveChat();
    }
    if (data.role) {
      console.log((data.role + ":").red);
      temp.role = data.role;
    }
    if (data.content) {
      process.stdout.write(data.content);
      temp.content += data.content;
    }
  }
}

function saveChat() {
  fs.writeFileSync(
    cfg.chat.chatHistoryPath,
    JSON.stringify({ messages }, null, 2)
  );
}

rl.on("line", async (input) => {
  if (!input.replace(/\s+/g, "")) return;
  if (input == "exit") process.exit();
  messages.push({ content: input, role: "user" });
  main();
});

console.log("Waiting for user input...".green, "\nuser:".cyan);
