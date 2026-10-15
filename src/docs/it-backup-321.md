# IT Lesson: Backups and the 3-2-1 Rule

The 3-2-1 rule: keep 3 copies of your data, on 2 different types of media, with 1 copy off-site (for example in the cloud or another location). A newer variation adds one copy that is offline or immutable so that ransomware cannot encrypt or delete it.

Two numbers define a recovery plan. RPO (recovery point objective) is how much data you can afford to lose, measured in time, such as 4 hours. RTO (recovery time objective) is how long you can afford to be down. Backups must be frequent enough for the RPO and restores fast enough for the RTO.

Backup types: a full backup copies everything; incremental copies changes since the last backup of any kind; differential copies changes since the last full backup.

A backup you have never restored is only a hope. Test restores regularly, monitor backup jobs for failures, protect backup accounts with MFA, and document the restore steps.
