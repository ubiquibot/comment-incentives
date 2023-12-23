import { createAppAuth } from "@octokit/auth-app";

export async function generateInstallationAccessToken(appId: string, privateKey: string, installationId: string) {
  const auth = createAppAuth({
    appId: appId,
    privateKey: privateKey,
    installationId: installationId,
  });

  const installationAccessToken = await auth({ type: "installation" });
  return installationAccessToken.token;
}
