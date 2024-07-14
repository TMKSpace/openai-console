"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const openai_1 = __importDefault(require("openai"));
const fs_1 = __importDefault(require("fs"));
const readline_1 = __importDefault(require("readline"));
require("colors");
console.clear();
console.log("Loading...".yellow);
class Config {
    constructor() {
        this.api = {
            apiKey: "Key"
        };
        this.ai = {
            model: "gpt-3.5-turbo",
            temperature: 1
        };
        this.chat = {
            chatHistoryPath: "chathistory.json"
        };
    }
    static checkoutConfig(config) {
        const entries = Object.entries(config);
        const newConfig = new this();
        this.checkoutEntries(entries, newConfig);
        console.log(newConfig);
        return newConfig;
    }
    static checkoutEntries(entries, linkedObject) {
        console.log(linkedObject);
        for (let [key, object] of entries) {
            if (typeof object == "object") {
                this.checkoutEntries(Object.entries(object), linkedObject[key]);
            }
            else if (linkedObject != undefined) {
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
    let config;
    if (fs_1.default.existsSync("./config.json")) {
        config = JSON.parse(fs_1.default.readFileSync("./config.json").toString());
        config = Config.checkoutConfig(config);
    }
    else
        config = new Config();
    fs_1.default.writeFileSync("./config.json", JSON.stringify(config, null, 2));
    return config;
}
const cfg = readConfig();
const rl = readline_1.default.createInterface(process.stdin, process.stdout);
if (!cfg.api.baseURL)
    delete cfg.api.baseURL;
const ai = new openai_1.default.OpenAI(cfg.api);
// Restore chat from save.
const messages = [];
if (fs_1.default.existsSync("./chathistory.json")) {
    const oldMessages = JSON.parse(fs_1.default.readFileSync(cfg.chat.chatHistoryPath).toString());
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
        messages: messages,
        temperature: cfg.ai.temperature,
        n: 1,
        stream: true
    })
        .catch(console.log);
    if (!response)
        return;
    let temp = { role: "assistant", content: "" };
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
    fs_1.default.writeFileSync(cfg.chat.chatHistoryPath, JSON.stringify({ messages }, null, 2));
}
rl.on("line", async (input) => {
    if (!input.replace(/\s+/g, ""))
        return;
    if (input == "exit")
        process.exit();
    messages.push({ content: input, role: "user" });
    main();
});
console.log("Waiting for user input...".green, "\nuser:".cyan);
