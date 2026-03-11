import type { DriveStep } from "driver.js";

const providerSelectStep: DriveStep = {
  element: '[data-tour="bugs-provider-select"]',
  popover: {
    title: "Choose Provider",
    description: "Select your bug tracking provider to get started.",
    side: "bottom",
    align: "center",
  },
};

export const jiraSetupTour: DriveStep[] = [
  {
    ...providerSelectStep,
    popover: {
      ...providerSelectStep.popover,
      description: "Select Jira as your bug tracker.",
    },
  },
  {
    element: '[data-tour="bugs-client-id"]',
    popover: {
      title: "Client ID",
      description:
        "Go to developer.atlassian.com → Profile icon → Developer console → Create → OAuth 2.0 integration. Then go to Settings in the left menu to find your Client ID.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-client-secret"]',
    popover: {
      title: "Client Secret",
      description:
        "On the same Settings page in your Atlassian Developer Console, copy the Client Secret.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-base-url"]',
    popover: {
      title: "Base URL (optional)",
      description:
        "Optionally enter your Jira Cloud URL if using a custom domain (e.g., https://yourteam.atlassian.net).",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-project-key"]',
    popover: {
      title: "Project Key",
      description:
        "Your project key is the prefix before issue numbers (e.g., PROJ in PROJ-123). Find it under Projects in Jira's top navigation.",
      side: "bottom",
      align: "start",
    },
  },
];

export const githubSetupTour: DriveStep[] = [
  {
    ...providerSelectStep,
    popover: {
      ...providerSelectStep.popover,
      description: "Select GitHub Issues.",
    },
  },
  {
    element: '[data-tour="bugs-client-id"]',
    popover: {
      title: "Client ID",
      description:
        "Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App. After registering, the Client ID is shown on the app page.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-client-secret"]',
    popover: {
      title: "Client Secret",
      description:
        "On your OAuth App page, click 'Generate a new client secret'. Copy it immediately — it won't be shown again.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-project-key"]',
    popover: {
      title: "Repository",
      description:
        "Enter as owner/repo (e.g., octocat/Hello-World) — read directly from your repository URL: github.com/{owner}/{repo}.",
      side: "bottom",
      align: "start",
    },
  },
];

export const youtrackSetupTour: DriveStep[] = [
  {
    ...providerSelectStep,
    popover: {
      ...providerSelectStep.popover,
      description: "Select YouTrack.",
    },
  },
  {
    element: '[data-tour="bugs-base-url"]',
    popover: {
      title: "Base URL",
      description:
        "Enter your YouTrack instance URL (e.g., https://myteam.youtrack.cloud).",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-client-id"]',
    popover: {
      title: "Client ID (Service ID)",
      description:
        "In YouTrack, go to Administration → Server Settings → Services → New service. After creation, find the Service ID (Client ID) on the service's Settings tab.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-client-secret"]',
    popover: {
      title: "Client Secret",
      description:
        "On the same Settings tab of your service in Hub, copy the Secret. You can regenerate it with the Change button.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="bugs-project-key"]',
    popover: {
      title: "Project Key",
      description:
        "The project short name appears as a prefix in issue IDs (e.g., XT in XT-123). Find it under Projects in YouTrack.",
      side: "bottom",
      align: "start",
    },
  },
];

export const genericSetupTour: DriveStep[] = [providerSelectStep];
