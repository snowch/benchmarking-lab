// Copyright © 2026 Christopher Snow
const themeButton = document.getElementById("theme") as HTMLButtonElement;
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
let explicitTheme = false;
function setTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  themeButton.textContent = dark ? "Light theme" : "Dark theme";
  themeButton.setAttribute(
    "aria-label",
    `Switch to ${dark ? "light" : "dark"} theme`,
  );
}
try {
  const saved = localStorage.getItem("benchmarking-lab:theme");
  explicitTheme = saved === "dark" || saved === "light";
  setTheme(explicitTheme ? saved === "dark" : systemTheme.matches);
} catch {
  setTheme(systemTheme.matches);
}
themeButton.onclick = () => {
  explicitTheme = true;
  setTheme(document.documentElement.dataset.theme !== "dark");
  try {
    localStorage.setItem(
      "benchmarking-lab:theme",
      document.documentElement.dataset.theme!,
    );
  } catch {
    /* Theme still works for this tab. */
  }
};
systemTheme.addEventListener("change", () => {
  if (!explicitTheme) setTheme(systemTheme.matches);
});
