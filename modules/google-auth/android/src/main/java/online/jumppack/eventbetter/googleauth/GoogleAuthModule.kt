package online.jumppack.eventbetter.googleauth

import android.accounts.Account
import android.app.Activity
import android.app.PendingIntent
import android.content.Context
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.ClearTokenRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.auth.api.identity.RevokeAccessRequest
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.Scope
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

private const val REQUEST_AUTHORIZE = 0xEB01
private const val GOOGLE_ACCOUNT_TYPE = "com.google"

// Google also reports some setup problems as a cancellation, so keep its message.
class SignInCancelledException(cause: Throwable) : CodedException("Sign-in was cancelled: ${cause.message}", cause)
class NoGoogleAccountException(cause: Throwable) : CodedException("No Google account is available on this device: ${cause.message}", cause)
class SignInFailedException(cause: Throwable) : CodedException("Google sign-in failed: ${cause.message}", cause)
class AuthorizationRequiredException : CodedException("The user needs to grant access interactively")
class AuthorizationCancelledException : CodedException("Access was not granted")
class AuthorizationFailedException(cause: Throwable) : CodedException("Google authorization failed: ${cause.message}", cause)

// Sign-in (who the user is) and authorization (Calendar access) are separate
// flows, as Google recommends: Credential Manager for the first,
// AuthorizationClient for the second. No tokens are stored here; Play services
// caches and refreshes access tokens itself.
class GoogleAuthModule : Module() {
  private var pendingAuthorization: CompletableDeferred<AuthorizationResult>? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val activity: Activity
    get() = appContext.currentActivity ?: throw Exceptions.MissingActivity()

  private val authorizationClient
    get() = Identity.getAuthorizationClient(context)

  override fun definition() = ModuleDefinition {
    Name("GoogleAuth")

    // Shows the Sign in with Google sheet. Returns basic profile only.
    AsyncFunction("signIn") Coroutine { webClientId: String ->
      val request = GetCredentialRequest.Builder()
        .addCredentialOption(GetSignInWithGoogleOption.Builder(webClientId).build())
        .build()

      val credential = try {
        CredentialManager.create(activity).getCredential(activity, request).credential
      } catch (e: GetCredentialCancellationException) {
        throw SignInCancelledException(e)
      } catch (e: NoCredentialException) {
        throw NoGoogleAccountException(e)
      } catch (e: GetCredentialException) {
        throw SignInFailedException(e)
      }

      val isGoogle = credential is CustomCredential && (
        credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL ||
          credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_SIWG_CREDENTIAL
        )
      if (!isGoogle) throw SignInFailedException(IllegalStateException("Unexpected credential type"))

      val google = GoogleIdTokenCredential.createFrom(credential.data)
      mapOf(
        "email" to (google.email ?: google.id),
        "name" to google.displayName,
        "photoUrl" to google.profilePictureUri?.toString()
      )
    }

    // With interactive = false this never shows UI, and rejects with
    // ERR_AUTHORIZATION_REQUIRED if the user hasn't granted the scopes yet.
    AsyncFunction("authorize") Coroutine { scopes: List<String>, email: String?, interactive: Boolean ->
      val builder = AuthorizationRequest.builder().setRequestedScopes(scopes.map { Scope(it) })
      if (email != null) builder.setAccount(Account(email, GOOGLE_ACCOUNT_TYPE))

      var result = try {
        authorizationClient.authorize(builder.build()).await()
      } catch (e: ApiException) {
        throw AuthorizationFailedException(e)
      }

      if (result.hasResolution()) {
        if (!interactive) throw AuthorizationRequiredException()
        result = resolve(requireNotNull(result.pendingIntent))
      }

      mapOf(
        "accessToken" to result.accessToken,
        "grantedScopes" to result.grantedScopes
      )
    }

    // Drops a cached access token so the next authorize() returns a fresh one.
    AsyncFunction("clearToken") Coroutine { token: String ->
      authorizationClient.clearToken(ClearTokenRequest.builder().setToken(token).build()).await()
      Unit
    }

    AsyncFunction("revokeAccess") Coroutine { email: String, scopes: List<String> ->
      val request = RevokeAccessRequest.builder()
        .setAccount(Account(email, GOOGLE_ACCOUNT_TYPE))
        .setScopes(scopes.map { Scope(it) })
        .build()
      authorizationClient.revokeAccess(request).await()
      Unit
    }

    AsyncFunction("signOut") Coroutine { ->
      CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest())
      Unit
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_AUTHORIZE) return@OnActivityResult
      val deferred = pendingAuthorization ?: return@OnActivityResult
      pendingAuthorization = null

      if (payload.resultCode != Activity.RESULT_OK) {
        deferred.completeExceptionally(AuthorizationCancelledException())
        return@OnActivityResult
      }
      try {
        deferred.complete(authorizationClient.getAuthorizationResultFromIntent(payload.data))
      } catch (e: ApiException) {
        deferred.completeExceptionally(AuthorizationFailedException(e))
      }
    }
  }

  private suspend fun resolve(pendingIntent: PendingIntent): AuthorizationResult {
    val deferred = CompletableDeferred<AuthorizationResult>()
    pendingAuthorization?.completeExceptionally(AuthorizationCancelledException())
    pendingAuthorization = deferred

    withContext(Dispatchers.Main) {
      activity.startIntentSenderForResult(pendingIntent.intentSender, REQUEST_AUTHORIZE, null, 0, 0, 0)
    }
    return deferred.await()
  }
}
