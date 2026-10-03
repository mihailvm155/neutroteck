import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@fontsource-variable/manrope";
import "@fontsource-variable/unbounded";
import "./style.css";

createRoot(document.getElementById("root")!).render(<App />);
