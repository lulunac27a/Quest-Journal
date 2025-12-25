package com.questjournal.app;

import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.SetOptions;

import java.util.HashMap;
import java.util.Map;

public class MainActivity extends BridgeActivity {

    private FirebaseAuth mAuth;
    private FirebaseAuth.AuthStateListener authListener;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        mAuth = FirebaseAuth.getInstance();
        authListener = firebaseAuth -> {
            FirebaseUser user = firebaseAuth.getCurrentUser();
            if (user != null) {
                ensureUserDocument(user.getUid());
            } else {
                Log.d("MainActivity", "No native Firebase user (web-based auth may be used).");
            }
        };
        mAuth.addAuthStateListener(authListener);
    }

    private void ensureUserDocument(String uid) {
        FirebaseFirestore db = FirebaseFirestore.getInstance();
        Map<String, Object> data = new HashMap<>();
        data.put("ownerId", uid);
        data.put("updatedAt", FieldValue.serverTimestamp());

        db.collection("users").document(uid)
            .set(data, SetOptions.merge())
            .addOnSuccessListener(unused -> Log.d("MainActivity", "ensureUserDocument OK for uid=" + uid))
            .addOnFailureListener(e -> Log.e("MainActivity", "ensureUserDocument FAILED", e));
    }

    @Override
    public void onDestroy() {
        if (mAuth != null && authListener != null) {
            mAuth.removeAuthStateListener(authListener);
        }
        super.onDestroy();
    }
}
