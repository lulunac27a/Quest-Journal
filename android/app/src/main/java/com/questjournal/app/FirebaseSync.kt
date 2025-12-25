package com.questjournal.app

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.SetOptions

object FirebaseSync {

    private val auth by lazy { FirebaseAuth.getInstance() }
    private val db by lazy { FirebaseFirestore.getInstance() }

    /**
     * ایجاد/مرج سند users/{uid} با فیلد ownerId (برای پاس‌شدن رول‌ها ضروری است).
     * اگر کاربر لاگین نباشد، callback با خطا صدا زده می‌شود.
     */
    fun ensureUserDocumentK(callback: (Exception?) -> Unit) {
        val uid = auth.currentUser?.uid
        if (uid == null) {
            callback(Exception("Not signed in"))
            return
        }
        val data = hashMapOf(
            "ownerId" to uid,
            "updatedAt" to FieldValue.serverTimestamp()
        )
        db.collection("users").document(uid)
            .set(data, SetOptions.merge())
            .addOnSuccessListener { callback(null) }
            .addOnFailureListener { e -> callback(e) }
    }

    /**
     * افزودن یک Quest نمونه در مسیر users/{uid}/quests
     */
    fun addQuestK(title: String, callback: (Exception?) -> Unit) {
        val uid = auth.currentUser?.uid
        if (uid == null) {
            callback(Exception("Not signed in"))
            return
        }
        val data = hashMapOf(
            "title" to title,
            "done" to false,
            "createdAt" to FieldValue.serverTimestamp()
        )
        db.collection("users").document(uid).collection("quests")
            .add(data)
            .addOnSuccessListener { callback(null) }
            .addOnFailureListener { e -> callback(e) }
    }
}
