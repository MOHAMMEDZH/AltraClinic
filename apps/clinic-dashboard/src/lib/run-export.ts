/** Run an async export action and surface failures to the user. */
export async function runExport(action: () => Promise<void>, fallbackMessage: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : fallbackMessage;
    window.alert(message);
  }
}
