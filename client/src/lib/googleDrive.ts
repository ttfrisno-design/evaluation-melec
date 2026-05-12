/**
 * Intégration Google Drive — Application MELEC Éval
 * Utilise l'API Google Drive via gapi (Google API Client Library)
 * Authentification OAuth2 avec le compte RMQUENEAU@gmail.com
 * 
 * Flux :
 * 1. L'utilisateur clique "Connecter Google Drive"
 * 2. Une popup OAuth Google s'ouvre
 * 3. Après autorisation, on peut lire/écrire des fichiers sur Drive
 */

// Client ID Google OAuth2 — utilise le flux implicite (token) côté client
// L'utilisateur doit autoriser l'accès à son Drive
const GOOGLE_CLIENT_ID = ""; // Sera configuré par l'utilisateur
const SCOPES = "https://www.googleapis.com/auth/drive.file";

// Types locaux pour Google Identity Services
interface GoogleTokenClient {
  requestAccessToken: () => void;
}

interface GoogleAccountsOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: { access_token?: string; error?: string }) => void;
  }) => GoogleTokenClient;
}

declare global {
  interface Window {
    googleAccounts?: GoogleAccountsOAuth2;
    gapi: {
      load: (lib: string, callback: () => void) => void;
      client: {
        init: (config: {
          apiKey?: string;
          clientId: string;
          discoveryDocs: string[];
          scope: string;
        }) => Promise<void>;
        drive: {
          files: {
            list: (params: Record<string, unknown>) => Promise<{ result: { files: DriveFile[] } }>;
            create: (params: Record<string, unknown>) => Promise<{ result: DriveFile }>;
            update: (params: Record<string, unknown>) => Promise<{ result: DriveFile }>;
            get: (params: Record<string, unknown>) => Promise<{ result: DriveFile }>;
          };
        };
      };
      auth2: {
        getAuthInstance: () => {
          isSignedIn: { get: () => boolean; listen: (cb: (v: boolean) => void) => void };
          signIn: () => Promise<void>;
          signOut: () => Promise<void>;
          currentUser: { get: () => { getBasicProfile: () => { getEmail: () => string; getName: () => string } } };
        };
      };
    };
  }
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

export interface DriveState {
  connected: boolean;
  email: string | null;
  accessToken: string | null;
  fileId: string | null; // ID du fichier grilleévaluationApplication.xlsx sur Drive
}

const DRIVE_STATE_KEY = "melec_drive_state";

export function loadDriveState(): DriveState {
  try {
    const stored = localStorage.getItem(DRIVE_STATE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return { connected: false, email: null, accessToken: null, fileId: null };
}

export function saveDriveState(state: DriveState) {
  localStorage.setItem(DRIVE_STATE_KEY, JSON.stringify(state));
}

// Charger le script Google Identity Services
export function loadGoogleScript(): Promise<void> {
  return new Promise((resolve) => {
    if (document.getElementById("google-gsi-script")) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

// Uploader ou mettre à jour un fichier sur Google Drive
export async function uploadToDrive(
  accessToken: string,
  fileBlob: Blob,
  fileName: string,
  existingFileId: string | null
): Promise<string> {
  const metadata = {
    name: fileName,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", fileBlob);

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

  const method = existingFileId ? "PATCH" : "POST";

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erreur Google Drive : ${err}`);
  }

  const result = await response.json();
  return result.id as string;
}

// Rechercher le fichier sur Drive par nom
export async function findFileOnDrive(
  accessToken: string,
  fileName: string
): Promise<string | null> {
  const query = encodeURIComponent(`name='${fileName}' and trashed=false`);
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) return null;

  const data = await response.json();
  const files = data.files as DriveFile[];
  return files.length > 0 ? files[0].id : null;
}

// Télécharger un fichier depuis Drive
export async function downloadFromDrive(
  accessToken: string,
  fileId: string
): Promise<ArrayBuffer> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error("Impossible de télécharger le fichier depuis Google Drive.");
  }

  return response.arrayBuffer();
}
