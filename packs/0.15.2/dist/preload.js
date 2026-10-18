"use strict";

// src/preload.ts
var import_electron = require("electron");
var CALLS = [
  "status",
  "frame",
  "autopilot",
  "take",
  "release",
  "input",
  "stopAll",
  "clear",
  "refreshApps",
  "createTask",
  "editTask",
  "taskFields",
  "approveTask",
  "taskAction",
  "savePolicy",
  "removePolicy",
  "saveKimi",
  "removeKimi",
  "testKimi",
  "pairPhone",
  "unpairPhone",
  "setSecret",
  "removeSecret",
  "viewer",
  "firewall",
  "updateCheck",
  "updateRestart",
  "dismissWhatsNew",
  "videoStart",
  "videoStop",
  "teachTarget",
  "teachStart",
  "teachPause",
  "teachMark",
  "teachStop",
  "teachEstimate",
  "teachWrite",
  "learned",
  "shot",
  "saveGuide",
  "renameApp",
  "deleteShot",
  "deleteApp",
  "exportApp",
  "setLimit",
  "appIcon",
  "openApp",
  "setAds",
  "captureOffer",
  "installedApps",
  "saveOffer",
  "tickOffer",
  "removeOffer",
  "chatThreads",
  "chatRead",
  "chatNew",
  "chatSend",
  "chatAct",
  "chatRename",
  "chatPin",
  "chatDelete",
  "chatFocus",
  "sandbox"
];
import_electron.contextBridge.exposeInMainWorld("hub", {
  call: (name, args) => {
    if (!CALLS.includes(name)) throw new Error("Unknown call.");
    return import_electron.ipcRenderer.invoke(name, args || {});
  },
  onStatus: (fn) => {
    import_electron.ipcRenderer.on("status", (_e, s) => fn(s));
  },
  onVideo: (fn) => {
    import_electron.ipcRenderer.on("video", (_e, p) => fn(p));
  }
});
