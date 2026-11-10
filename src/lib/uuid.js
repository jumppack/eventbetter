// A version 4 UUID, the format Calendar requires for event label ids. Ids only
// need to be unique within one calendar, so Math.random is enough; React Native
// has no guaranteed crypto.randomUUID.
export function uuid(random = Math.random) {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(random() * 16);
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}
