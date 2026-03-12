import type { DriveStep } from "driver.js";

const callbackUrl = '<code class="tour-copy" data-copy="http://127.0.0.1">http://127.0.0.1</code>';

export const jiraSetupTour: DriveStep[] = [
  {
    element: '[data-tour="bugs-client-id"]',
    popover: {
      title: "Client ID",
      description:
        `Open the <a class="tour-link" href="https://developer.atlassian.com/console/myapps/">Atlassian Developer Console</a>. Create an OAuth 2.0 (3LO) app. In the app's "Authorization" section, configure OAuth 2.0 (3LO) and set callback URL to ${callbackUrl}. Then go to "Settings" in the left menu — your Client ID is displayed there.`,
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-client-secret"]',
    popover: {
      title: "Client Secret",
      description:
        'On the same "Settings" page in your Atlassian Developer Console, copy the Client Secret shown below the Client ID.',
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-base-url"]',
    popover: {
      title: "Base URL (optional)",
      description:
        "Your Jira Cloud URL, e.g. https://yourteam.atlassian.net. Leave empty to use the default resolved from your OAuth token.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-project-key"]',
    popover: {
      title: "Project Key",
      description:
        "The prefix before issue numbers (e.g. PROJ in PROJ-123). Find it in Jira under Projects in the top navigation — the key is shown next to each project name.",
      side: "bottom",
      align: "start",
    },
  },
];

export const githubSetupTour: DriveStep[] = [
  {
    element: '[data-tour="bugs-client-id"]',
    popover: {
      title: "Client ID",
      description:
        `Go to <a class="tour-link" href="https://github.com/settings/applications/new">GitHub → New OAuth App</a>. Set the Authorization callback URL to ${callbackUrl} and register the app. Your Client ID is shown on the app page after creation.`,
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-client-secret"]',
    popover: {
      title: "Client Secret",
      description:
        'On your OAuth App page, click "Generate a new client secret". Copy it immediately — GitHub only shows it once. If lost, you\'ll need to regenerate it.',
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-project-key"]',
    popover: {
      title: "Repository",
      description:
        "Enter as owner/repo (e.g. octocat/Hello-World). This matches your GitHub URL: github.com/{owner}/{repo}.",
      side: "bottom",
      align: "start",
    },
  },
];

export const youtrackSetupTour: DriveStep[] = [
  {
    element: '[data-tour="bugs-base-url"]',
    popover: {
      title: "Base URL",
      description:
        "Your YouTrack instance URL, e.g. https://myteam.youtrack.cloud. This is used for both API calls and OAuth endpoints.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-client-id"]',
    popover: {
      title: "Client ID (Service ID)",
      description:
        `In YouTrack, go to Administration → Access Management → Auth Modules. Create a new OAuth 2.0 service and set the redirect URI to ${callbackUrl}. The Service ID shown after creation is your Client ID.`,
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-client-secret"]',
    popover: {
      title: "Client Secret",
      description:
        "The Secret is shown when you create the OAuth service. If you need to regenerate it, go to the service settings in Administration → Access Management → Auth Modules.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-project-key"]',
    popover: {
      title: "Project Key",
      description:
        "The short name prefix in issue IDs (e.g. XT in XT-123). Find it under Projects in the YouTrack main menu — the key is listed next to each project.",
      side: "bottom",
      align: "start",
    },
  },
];

export const genericSetupTour: DriveStep[] = [
  {
    element: '[data-tour="bugs-provider-select"]',
    popover: {
      title: "Choose Provider",
      description: "Select your bug tracking provider to get started.",
      side: "bottom",
      align: "center",
    },
  },
];
