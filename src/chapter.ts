// Copyright © 2026 Christopher Snow
import "./theme";
document.getElementById("build")!.textContent = __BUILD__;
const contents = document.querySelector<HTMLDetailsElement>(".book-contents");
if (contents) {
  const phone = matchMedia("(max-width: 750px)");
  const updateContents = () => {
    contents.open = !phone.matches;
  };
  updateContents();
  phone.addEventListener("change", updateContents);
}
