# Frontend contributor instructions

- Scope all work to frontend/. Do not modify files elsewhere in the repository.
- Run frontend commands from this directory using Node 24 and npm.
- Keep frontend code, dependencies, assets, mocks, environment examples, and
  build configuration here. Do not add root package manifests or lockfiles.
- Keep App.tsx focused on composition; extract components and features as the
  app grows. Use TypeScript and semantic, accessible HTML.
- Preserve React strict mode. Avoid unnecessary dependencies and premature
  state-management abstractions.
- Use a dedicated API client when integration begins. Agree on API contracts
  with backend contributors before implementing endpoints.
- Never put secrets in client code or VITE_* environment variables. Clearly
  label mock data when it is displayed as product data.
- Use installed frontend and React skills when available. Use visual concepts
  when product design begins, not for tooling-only work.
- Run npm run check and npm run build before handoff. For UI changes, also
  verify the affected behavior in a browser and at a mobile size.
- Keep temporary screenshots, traces, and QA scripts outside the repository.
