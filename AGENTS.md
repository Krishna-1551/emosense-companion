# Project architecture rules

- Keep the admin dashboard grouped into collapsible domain sections while summary metrics and urgent alerts remain always visible, because administrators need concise scanning without losing access to existing controls.

- Keep voice input/output (browser Web Speech and the cloud speak function) routed through the single existing chat send flow, with the mic only started by explicit user action, because duplicate backends or auto-listening would break history and privacy.
