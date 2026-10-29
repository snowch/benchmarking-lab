// Copyright © 2026 Christopher Snow
import "./theme";
document.getElementById("build")!.textContent = __BUILD__;
const contents = document.querySelector<HTMLDetailsElement>(".book-contents");
if (contents && matchMedia("(max-width: 750px)").matches) contents.open = false;
