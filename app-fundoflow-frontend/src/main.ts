import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router";
import { openDb } from "./db/sqlite";
import "./style.css";

async function bootstrap() {
  await openDb();
  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.mount("#app");
}

bootstrap().catch((err) => {
  console.error("Failed to bootstrap FundoFlow:", err);
  document.body.innerHTML = `<pre style="padding:2rem;font-family:monospace;color:#b91c1c">${String(err)}</pre>`;
});
