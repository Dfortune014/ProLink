import {
    CognitoUserPool,
    CognitoUser,
    AuthenticationDetails,
    CognitoUserAttribute,
    CognitoRefreshToken,
    ICognitoUserPoolData,
    CognitoUserSession,
  } from "amazon-cognito-identity-js";
  
  // Token storage keys
  const STORAGE_KEYS = {
    ACCESS_TOKEN: "cognito_access_token",
    ID_TOKEN: "cognito_id_token",
    REFRESH_TOKEN: "cognito_refresh_token",
    EXPIRES_AT: "cognito_expires_at",
    USER_EMAIL: "cognito_user_email",
  } as const;
  
  // Initialize Cognito User Pool
  const getCognitoConfig = (): ICognitoUserPoolData => {
    const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  
    if (!userPoolId || !clientId) {
      throw new Error(
        "Missing Cognito configuration. Please check your .env.local file."
      );
    }
  
    return {
      UserPoolId: userPoolId,
      ClientId: clientId,
    };
  };
  
  const userPool = new CognitoUserPool(getCognitoConfig());
  
  // Helper function to get current user
  const getCurrentCognitoUser = (): CognitoUser | null => {
    return userPool.getCurrentUser();
  };

  // Helper function to get user info from stored tokens (fallback when Cognito session isn't available)
  const getCurrentUserFromStorage = (): {
    email: string;
    username: string;
  } | null => {
    try {
      const idToken = tokenStorage.getIdToken();
      if (!idToken) {
        console.log("AuthService: No ID token in storage");
        return null;
      }

      // Decode ID token to get user info
      const payload = JSON.parse(atob(idToken.split(".")[1]));
      const email = payload.email || payload["cognito:username"] || "";
      const username = payload["cognito:username"] || payload.sub || "";

      if (!email && !username) {
        console.log("AuthService: No email or username in ID token");
        return null;
      }

      // Store email in localStorage for consistency
      if (email) {
        localStorage.setItem(STORAGE_KEYS.USER_EMAIL, email);
      }

      console.log("AuthService: Got user from storage tokens:", { email, username });
      return { email, username };
    } catch (err) {
      console.error("AuthService: Failed to get user from storage:", err);
      return null;
    }
  };
  
  // Token storage helpers
  const tokenStorage = {
    setTokens: (accessToken: string, idToken: string, refreshToken: string, expiresIn: number) => {
      const expiresAt = Date.now() + expiresIn * 1000;
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      localStorage.setItem(STORAGE_KEYS.ID_TOKEN, idToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, expiresAt.toString());
    },
  
    getAccessToken: (): string | null => {
      return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    },
  
    getIdToken: (): string | null => {
      return localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
    },
  
    getRefreshToken: (): string | null => {
      return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    },
  
    getExpiresAt: (): number | null => {
      const expiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
      return expiresAt ? parseInt(expiresAt, 10) : null;
    },
  
    clear: () => {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.ID_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
      localStorage.removeItem(STORAGE_KEYS.USER_EMAIL);
    },
  };
  
  // Auth Service
  export const authService = {
    /**
     * Sign up a new user
     */
    signUp: async (
        email: string,
        password: string,
        fullname: string,
        date_of_birth: string,
        username: string,
    ): Promise<void> => {
      // Validate required fields (Cognito doesn't enforce required custom attributes)
      if (!email || !email.trim()) {
        throw new Error("Email is required");
      }
      if (!fullname || !fullname.trim()) {
        throw new Error("Full name is required");
      }
      if (!username || !username.trim()) {
        throw new Error("Username is required");
      }
      // Validate username format (alphanumeric, underscore, hyphen, 3-20 chars)
      const usernameRegex = /^[a-z0-9_-]{3,20}$/i;
      if (!usernameRegex.test(username)) {
        throw new Error("Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens");
      }

      return new Promise((resolve, reject) => {
        const attributeList = [
          new CognitoUserAttribute({
            Name: "email",
            Value: email.trim(),
          }),
          new CognitoUserAttribute({
            Name: "custom:fullname",
            Value: fullname.trim(),
          }),
          new CognitoUserAttribute({
            Name: "custom:date_of_birth",
            Value: date_of_birth.trim(),
          }),
          new CognitoUserAttribute({
            Name: "custom:username",
            Value: username.trim().toLowerCase(),
          }),
        ];
  
        userPool.signUp(email, password, attributeList, [], (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          if (!result) {
            reject(new Error("Sign up failed: No result returned"));
            return;
          }
          resolve();
        });
      });
    },
  
    /**
     * Sign in with email and password
     */
    signIn: async (email: string, password: string): Promise<{
      accessToken: string;
      idToken: string;
      refreshToken: string;
    }> => {
      return new Promise((resolve, reject) => {
        const authenticationDetails = new AuthenticationDetails({
          Username: email,
          Password: password,
        });
  
        const cognitoUser = new CognitoUser({
          Username: email,
          Pool: userPool,
        });
  
        cognitoUser.authenticateUser(authenticationDetails, {
          onSuccess: (result) => {
            const accessToken = result.getAccessToken().getJwtToken();
            const idToken = result.getIdToken().getJwtToken();
            const refreshToken = result.getRefreshToken().getToken();
            const expiresIn = result.getAccessToken().getExpiration();
  
            tokenStorage.setTokens(accessToken, idToken, refreshToken, expiresIn);
            localStorage.setItem(STORAGE_KEYS.USER_EMAIL, email);
  
            resolve({
              accessToken,
              idToken,
              refreshToken,
            });
          },
          onFailure: (err) => {
            reject(err);
          },
          newPasswordRequired: (userAttributes, requiredAttributes) => {
            // Handle new password required (first time login)
            reject(new Error("New password required. Please use the forgot password flow."));
          },
        });
      });
    },
  
    /**
     * Sign out the current user
     */
    signOut: async (): Promise<void> => {
      return new Promise((resolve, reject) => {
        const cognitoUser = getCurrentCognitoUser();
        if (cognitoUser) {
          cognitoUser.signOut(() => {
            tokenStorage.clear();
            resolve();
          });
        } else {
          tokenStorage.clear();
          resolve();
        }
      });
    },
  
    /**
     * Get the current authenticated user
     */
    getCurrentUser: async (): Promise<{
      email: string;
      username: string;
    } | null> => {
      return new Promise((resolve, reject) => {
        // First, try to get user from Cognito session
        const cognitoUser = getCurrentCognitoUser();
        if (cognitoUser) {
          cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
            if (err || !session || !session.isValid()) {
              // Session invalid, try fallback to localStorage tokens
              console.log("AuthService: Cognito session invalid, trying localStorage fallback");
              const fallbackUser = getCurrentUserFromStorage();
              resolve(fallbackUser);
              return;
            }
  
            // Update tokens from session
            const accessToken = session.getAccessToken().getJwtToken();
            const idToken = session.getIdToken().getJwtToken();
            const refreshToken = session.getRefreshToken().getToken();
            const expiresIn = session.getAccessToken().getExpiration();
  
            tokenStorage.setTokens(accessToken, idToken, refreshToken, expiresIn);
  
            cognitoUser.getUserAttributes((err, attributes) => {
              if (err) {
                // If getUserAttributes fails, try fallback to localStorage
                console.log("AuthService: getUserAttributes failed, trying localStorage fallback");
                const fallbackUser = getCurrentUserFromStorage();
                resolve(fallbackUser);
                return;
              }
  
              const emailAttr = attributes?.find((attr) => attr.getName() === "email");
              const email = emailAttr?.getValue() || "";
              const username = cognitoUser.getUsername();
  
              if (email) {
                localStorage.setItem(STORAGE_KEYS.USER_EMAIL, email);
              }
  
              resolve({
                email,
                username,
              });
            });
          });
        } else {
          // No Cognito user, try to get user info from stored tokens
          console.log("AuthService: No Cognito user found, trying localStorage fallback");
          const fallbackUser = getCurrentUserFromStorage();
          resolve(fallbackUser);
        }
      });
    },
  
    /**
     * Get the current access token
     */
    getAccessToken: async (): Promise<string | null> => {
      // Check if token is expired
      const expiresAt = tokenStorage.getExpiresAt();
      if (expiresAt && Date.now() >= expiresAt - 5 * 60 * 1000) {
        // Token expires in less than 5 minutes, try to refresh
        try {
          await authService.refreshToken();
        } catch (error) {
          // Refresh failed, clear tokens
          tokenStorage.clear();
          return null;
        }
      }
  
      return tokenStorage.getAccessToken();
    },

    /**
     * Get the current ID token
     */
    getIdToken: (): string | null => {
      return tokenStorage.getIdToken();
    },
  
    /**
     * Refresh the access token using refresh token
     */
    refreshToken: async (): Promise<string> => {
      return new Promise((resolve, reject) => {
        const cognitoUser = getCurrentCognitoUser();
        const refreshToken = tokenStorage.getRefreshToken();
  
        if (!cognitoUser || !refreshToken) {
          reject(new Error("No user session or refresh token found"));
          return;
        }
  
        cognitoUser.refreshSession(
          {
            refreshToken: refreshToken,
          },
          (err, session) => {
            if (err || !session) {
              tokenStorage.clear();
              reject(err || new Error("Failed to refresh session"));
              return;
            }
  
            const accessToken = session.getAccessToken().getJwtToken();
            const idToken = session.getIdToken().getJwtToken();
            const newRefreshToken = session.getRefreshToken().getToken();
            const expiresIn = session.getAccessToken().getExpiration();
  
            tokenStorage.setTokens(accessToken, idToken, newRefreshToken, expiresIn);
  
            resolve(accessToken);
          }
        );
      });
    },
  
    /**
     * Check if user is authenticated
     */
    isAuthenticated: async (): Promise<boolean> => {
      try {
        const accessToken = await authService.getAccessToken();
        return accessToken !== null;
      } catch {
        return false;
      }
    },
  
    /**
     * Handle OAuth callback - exchange authorization code for tokens
     */
    handleOAuthCallback: async (code: string): Promise<{
      accessToken: string;
      idToken: string;
      refreshToken: string;
    }> => {
      const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
      const domain = import.meta.env.VITE_COGNITO_DOMAIN;

      if (!clientId || !domain) {
        throw new Error("Missing OAuth configuration");
      }

      // CRITICAL: The redirect URI MUST match exactly what was used in the authorization request
      // We use the current window location to ensure consistency with getOAuthRedirectUrl()
      const currentOrigin = window.location.origin;
      // Ensure no trailing slash and exact path match (same logic as getOAuthRedirectUrl)
      const redirectUri = `${currentOrigin}/auth/callback`.replace(/\/+$/, '');
      
      console.log("OAuth Token Exchange - Redirect URI:", {
        redirectUri,
        currentOrigin,
        pathname: window.location.pathname,
        "⚠️ CRITICAL": "This must match EXACTLY what was used in the authorization request"
      });
  
      // Exchange authorization code for tokens
      const tokenEndpoint = `https://${domain}/oauth2/token`;
      
      const params = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        code: code,
        redirect_uri: redirectUri,
      });
  
      console.log("OAuth Token Exchange Request:", {
        endpoint: tokenEndpoint,
        clientId: clientId,
        redirectUri: redirectUri,
        codeLength: code.length,
        hasCode: !!code,
      });

      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      console.log("OAuth Token Exchange Response:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OAuth Token Exchange Error Response:", errorText);
        let errorMessage = `OAuth token exchange failed (${response.status}): ${errorText}`;
        
        // Try to parse as JSON for better error messages
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) {
            errorMessage = `OAuth error: ${errorJson.error} - ${errorJson.error_description || errorText}`;
          }
        } catch {
          // Not JSON, use text as-is
        }
        
        throw new Error(errorMessage);
      }
  
      const data = await response.json();
      console.log("OAuth Token Exchange Success - Token data received:", {
        hasAccessToken: !!data.access_token,
        hasIdToken: !!data.id_token,
        hasRefreshToken: !!data.refresh_token,
        expiresIn: data.expires_in,
      });

      const { access_token, id_token, refresh_token, expires_in } = data;

      if (!access_token || !id_token || !refresh_token) {
        console.error("OAuth Token Exchange - Missing tokens in response:", {
          hasAccessToken: !!access_token,
          hasIdToken: !!id_token,
          hasRefreshToken: !!refresh_token,
          responseKeys: Object.keys(data),
        });
        throw new Error("Invalid token response from Cognito - missing required tokens");
      }
  
      // Store tokens
      tokenStorage.setTokens(access_token, id_token, refresh_token, expires_in);
  
      // Get user email from ID token
      try {
        const payload = JSON.parse(atob(id_token.split(".")[1]));
        const email = payload.email || payload["cognito:username"];
        if (email) {
          localStorage.setItem(STORAGE_KEYS.USER_EMAIL, email);
        }
      } catch (error) {
        console.warn("Failed to extract email from ID token", error);
      }
  
      return {
        accessToken: access_token,
        idToken: id_token,
        refreshToken: refresh_token,
      };
    },
  
    /**
     * Get OAuth redirect URL for social login
     */
    getOAuthRedirectUrl: (provider: "Google" | "LinkedIn"): string => {
      const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
      const domain = import.meta.env.VITE_COGNITO_DOMAIN;

      if (!clientId || !domain) {
        throw new Error("Missing OAuth configuration");
      }

      // Use current window location for redirect URI to ensure it matches the callback
      // This handles cases where the app is running on a different port than configured
      const currentOrigin = window.location.origin;
      // Ensure no trailing slash and exact path match
      const redirectUriRaw = `${currentOrigin}/auth/callback`.replace(/\/+$/, '');
      const redirectUri = encodeURIComponent(redirectUriRaw);
      
      console.log("OAuth Redirect URL Generation:", {
        provider,
        currentOrigin,
        redirectUriRaw,
        redirectUriEncoded: redirectUri,
        domain,
        clientId,
        "⚠️ IMPORTANT": "This redirect URI must match EXACTLY what's configured in Cognito User Pool",
        "Expected in Cognito": ["http://localhost:3000/auth/callback", "http://localhost:8080/auth/callback"]
      });

      const scopes = encodeURIComponent("email openid profile");
      const responseType = "code";
      const identityProvider = provider;

      return `https://${domain}/oauth2/authorize?client_id=${clientId}&response_type=${responseType}&scope=${scopes}&redirect_uri=${redirectUri}&identity_provider=${identityProvider}`;
    },

    /**
     * Confirm sign up with verification code
     */
    confirmSignUp: async (email: string, code: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const cognitoUser = new CognitoUser({
          Username: email,
          Pool: userPool,
        });

        cognitoUser.confirmRegistration(code, true, (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    },

    /**
     * Resend verification code
     */
    resendVerificationCode: async (email: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const cognitoUser = new CognitoUser({
          Username: email,
          Pool: userPool,
        });

        cognitoUser.resendConfirmationCode((err, result) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    },

    /**
     * Update user attributes in Cognito
     */
    updateUserAttributes: async (attributes: Record<string, string>): Promise<void> => {
      return new Promise((resolve, reject) => {
        let cognitoUser = getCurrentCognitoUser();
        
        // If no current user (e.g., after OAuth), create one from stored email/token
        if (!cognitoUser) {
          const idToken = tokenStorage.getIdToken();
          if (!idToken) {
            reject(new Error("No user is currently signed in"));
            return;
          }
          
          try {
            // Decode ID token to get email/username
            const payload = JSON.parse(atob(idToken.split(".")[1]));
            const email = payload['email'] || payload['cognito:username'];
            
            if (!email) {
              reject(new Error("No email found in token"));
              return;
            }
            
            // Create CognitoUser instance from email
            cognitoUser = new CognitoUser({
              Username: email,
              Pool: userPool,
            });
          } catch (err) {
            reject(new Error("Failed to create user session: " + (err instanceof Error ? err.message : String(err))));
            return;
          }
        }

        // Define updateAttributes function
        const updateAttributes = () => {
          const attributeList = Object.entries(attributes).map(
            ([key, value]) => new CognitoUserAttribute({ Name: key, Value: value })
          );

          cognitoUser!.updateAttributes(attributeList, (err, result) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        };

        // Try to establish session first
        cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
          if (err || !session || !session.isValid()) {
            // Session not established - try to refresh using refresh token
            const refreshToken = tokenStorage.getRefreshToken();
            if (!refreshToken) {
              reject(new Error("Session expired and no refresh token available. Please sign in again."));
              return;
            }

            // Try to refresh the session
            cognitoUser!.refreshSession(new CognitoRefreshToken({ RefreshToken: refreshToken }), (refreshErr, newSession) => {
              if (refreshErr || !newSession) {
                reject(new Error("Failed to establish session. Please sign in again."));
                return;
              }
              
              // Session established, update tokens
              const accessToken = newSession.getAccessToken().getJwtToken();
              const idToken = newSession.getIdToken().getJwtToken();
              const newRefreshToken = newSession.getRefreshToken().getToken();
              const expiresIn = newSession.getAccessToken().getExpiration();
              tokenStorage.setTokens(accessToken, idToken, newRefreshToken, expiresIn);
              
              // Now update attributes
              updateAttributes();
            });
          } else {
            // Session is valid, update attributes
            updateAttributes();
          }
        });
      });
    },

    /**
     * Get user attributes from Cognito
     */
    getUserAttributes: async (): Promise<Record<string, string>> => {
      return new Promise((resolve, reject) => {
        const cognitoUser = getCurrentCognitoUser();
        if (!cognitoUser) {
          reject(new Error("No user is currently signed in"));
          return;
        }

        cognitoUser.getUserAttributes((err, attributes) => {
          if (err) {
            reject(err);
            return;
          }

          const attributesMap: Record<string, string> = {};
          if (attributes) {
            attributes.forEach((attr) => {
              attributesMap[attr.getName()] = attr.getValue();
            });
          }
          resolve(attributesMap);
        });
      });
    },
  };