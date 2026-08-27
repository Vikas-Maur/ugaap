## UGAAP interface rules

- Never use a card-based layout. Do not place ordinary navigation, features, metrics, forms, or content in repeated floating rounded rectangles. Build hierarchy with typography, spacing, alignment, rules, restrained surfaces, and clearly visible borders.
- The primary visual language is blue, drawing from the Ashoka Chakra. Use subtle gradients only where they improve depth or orientation. Maintain strong text contrast and borders that remain clearly visible against their background.
- Keep the signed-out site minimal. Public navigation is limited to public information, legal pages, language selection, and authentication. Grievance catalogue, forms, drafts, and other citizen operations require authentication.
- Use TanStack Router `Link` or `navigate` for internal navigation. Do not use raw internal `<a href>` links or `window.location.assign()`.
- Don't take browser control again and again or on every small change. Only when its certainly needed.
