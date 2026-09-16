import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  imports: false,
  manifest: {
    name: "Oggy",
    description: "Teaching AI to use a website, one step at a time!",
    version: "0.1.0",
    permissions: ["storage", "sidePanel", "scripting", "tabs", "webNavigation"],
    host_permissions: ["http://*/*", "https://*/*"],
    web_accessible_resources: [
      {
        matches: ["<all_urls>"],
        resources: ["oggy-main.js"],
      },
    ],
    side_panel: {
      default_path: "sidepanel.html",
    },
    action: {
      default_title: "Oggy",
    },
  },
});
