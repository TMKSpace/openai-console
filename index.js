const openai = require("openai");
const readline = require("readline"),
  fs = require("fs");
require("colors");

console.clear();
console.log("Loading...".yellow);

const cfg = fs.existsSync("./config.json")
  ? require("./config.json")
  : (() => {
      const data = {
        api: {
          apiKey: "KEY",
          baseURL: "", // As undefined.
        },
        ai: {
          model: "gpt-3.5-turbo",
          temperature: 1,
        },
        chat: {
          autoSaveOnExit: false,
          disableSaveOnExitMessage: false,
        },
      };
      fs.writeFileSync("./config.json", JSON.stringify(data));
      return data;
    })();

const rl = readline.createInterface(process.stdin, process.stdout);

if (!cfg.api.baseURL) delete cfg.api.baseURL;
const ai = new openai.OpenAI(cfg.api);

const messages = [];
if (fs.existsSync("./chathistory.json")) {
  const oldMessages = require("./chathistory.json").messages;
  messages.push(...oldMessages);
  oldMessages.forEach((i) => {
    const rolemsg = (i.role + ":")
    console.log((i.role == "user") ? rolemsg.cyan : rolemsg.red);
    console.log(i.content.gray);
  });
  console.log("\n");
}
let printing = false;

const chat = async () => {
  printing = true;
  const response = await ai.chat.completions.create({
    model: cfg.ai.model,
    messages,
    temperature: cfg.ai.temperature,
    n: 1,
    stream: true,
  });
  let temp = { role: "", content: "" };
  for await (let part of response) {
    const data = part.choices[0].delta;
    if (part.choices[0].finish_reason) {
      printing = false;
      messages.push(temp);
      console.log("\nuser:".cyan);
      return;
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
};

const saveChat = () => {
  fs.writeFileSync("chathistory.json", JSON.stringify({ messages }));
  console.log("Chat was saved!".green);
};

const saveQuestion = () => {
  if (cfg.chat.autoSaveOnExit || cfg.chat.disableSaveOnExitMessage) {
    if (cfg.chat.autoSaveOnExit) saveChat();
    return;
  } else
    rl.question("\nSave chat? (y/n) > ".yellow, (answ) => {
      if (answ.toLowerCase() == "y") {
        saveChat();
      }else{
        console.log("Chat was not saved!".red);
      }
      process.exit();
    });
};

let saveMessage = false;
rl.on("line", async (input) => {
  if (!input.replace(/\s+/g, "")) return;
  if (printing) return process.write("...");
  if (saveMessage) return;
  if (input == "exit") saveQuestion();
  messages.push({ content: input, role: "user" });
  chat();
});
console.log("Waiting for user input...".green,"\nuser:".cyan);

rl.on("SIGINT", () => saveQuestion());
