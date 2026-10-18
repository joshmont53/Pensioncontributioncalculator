
  # Pension Contribution Calculator

  This is a code bundle for Pension Contribution Calculator. The original project is available at https://www.figma.com/design/M0JCLLLblVsGqlCcY81RTI/Pension-Contribution-Calculator.

  ## Repository layout

  | Folder | What it is |
  | --- | --- |
  | `/` (`src/`) | Desktop web app (Vite + React) |
  | `mobile/` | Native iOS app (Expo + React Native) |
  | `packages/core/` | Calculation logic shared by both apps (pure TypeScript) |
  | `tests/` | Regression tests for the calculations and web results pages |

  Change a calculation once in `packages/core` and both apps pick it up.

  ## Running the code

  The repo is a pnpm workspace. Run `pnpm install` once at the root to install dependencies for every app.

  ### Web app

  Run `pnpm dev` to start the web development server. It reloads automatically when you save.

  ### iPhone app

  One-off setup: install Xcode, open it once to accept the licence, then point the command-line tools at it:

  ```sh
  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
  ```

  Then run `pnpm dev:ios`. It starts the Expo dev server, opens the iPhone Simulator and loads the app in Expo Go. Saved changes appear in the simulator straight away (Fast Refresh). In the terminal, press `r` to reload the app or `i` to reopen it in the simulator.

  Both apps can run at the same time — start each in its own terminal.

  ## Checks

  - `pnpm test` — regression tests for the shared calculations and the web results pages.
  - `pnpm build` — production build of the web app.
  - `pnpm typecheck:mobile` — TypeScript check for the iPhone app.
