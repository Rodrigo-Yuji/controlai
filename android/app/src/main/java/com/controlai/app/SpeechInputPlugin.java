package com.controlai.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

@CapacitorPlugin(name = "SpeechInput", permissions = {
    @Permission(alias = "microphone", strings = {Manifest.permission.RECORD_AUDIO})
})
public class SpeechInputPlugin extends Plugin {
    private boolean recognizing = false;

    @PluginMethod
    public void start(PluginCall call) {
        if (recognizing) { call.reject("Reconhecimento já está em andamento.", "BUSY"); return; }
        recognizing = true;
        getActivity().runOnUiThread(() -> {
            if (getPermissionState("microphone") != PermissionState.GRANTED) {
                requestPermissionForAlias("microphone", call, "microphonePermission");
            } else {
                recognize(call);
            }
        });
    }

    @PermissionCallback
    private void microphonePermission(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            recognizing = false;
            call.reject("Permita o microfone nas configurações do ControlAI.", "PERMISSION_DENIED");
            return;
        }
        recognize(call);
    }

    private void recognize(PluginCall call) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR");
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Diga um lançamento, por exemplo: comprei almoço por 40 reais");
        try {
            startActivityForResult(call, intent, "speechResult");
        } catch (ActivityNotFoundException error) {
            recognizing = false;
            call.reject("Ative um serviço de reconhecimento de voz no Android ou use o ditado do teclado.", "UNAVAILABLE");
        } catch (SecurityException error) {
            recognizing = false;
            call.reject("O Android bloqueou o reconhecimento de voz. Confira as permissões do microfone.", "PERMISSION_DENIED");
        }
    }

    @ActivityCallback
    private void speechResult(PluginCall call, ActivityResult result) {
        recognizing = false;
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Reconhecimento cancelado ou sem fala reconhecida.", "CANCELLED");
            return;
        }
        ArrayList<String> texts = result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        if (texts == null || texts.isEmpty() || texts.get(0).trim().isEmpty()) {
            call.reject("Não foi possível reconhecer uma frase.", "NO_SPEECH");
            return;
        }
        JSObject response = new JSObject();
        response.put("text", texts.get(0).trim());
        call.resolve(response);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(intent);
                call.resolve();
            } catch (ActivityNotFoundException error) {
                call.reject("Abra Configurações > Aplicativos > ControlAI > Permissões.", "UNAVAILABLE");
            }
        });
    }
}
