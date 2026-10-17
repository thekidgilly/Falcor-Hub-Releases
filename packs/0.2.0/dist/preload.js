"use strict";

// src/preload.ts
var import_electron = require("electron");
var CALLS = ["status", "frame", "autopilot", "take", "release", "input", "stopAll", "clear", "refreshApps", "createTask", "approveTask", "taskAction", "savePolicy", "removePolicy", "saveKimi", "removeKimi", "testKimi", "pairPhone", "unpairPhone", "setSecret", "removeSecret", "viewer", "firewall", "updateCheck", "updateRestart", "dismissWhatsNew"];
import_electron.contextBridge.exposeInMainWorld("hub", {
  call: (name, args) => {
    if (!CALLS.includes(name)) throw new Error("Unknown call.");
    return import_electron.ipcRenderer.invoke(name, args || {});
  },
  onStatus: (fn) => {
    import_electron.ipcRenderer.on("status", (_e, s) => fn(s));
  }
});
