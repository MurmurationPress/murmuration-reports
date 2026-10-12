/** Parse an adoption candidate without inserting it into the DOM or executing it. */
export function validateSvgAdoption(content: string): void {
  const document = new DOMParser().parseFromString(content, "image/svg+xml");
  if (
    document.getElementsByTagName("parsererror").length ||
    document.documentElement.localName !== "svg" ||
    (document.documentElement.namespaceURI !== null &&
      document.documentElement.namespaceURI !== "http://www.w3.org/2000/svg")
  )
    throw new Error("Existing output is not well-formed SVG XML.");
}
