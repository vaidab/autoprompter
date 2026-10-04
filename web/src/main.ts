import "./styles.css";
import { setup } from "./setup";
import { prompter } from "./prompter";
if (location.pathname === "/prompter") prompter();
else setup();
