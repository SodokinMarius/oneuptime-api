import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("webhooks", "0001_initial"),
        ("rbac", "0002_resource_policy"),
    ]

    operations = [
        migrations.AddField(
            model_name="webhook",
            name="team",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="webhooks",
                to="rbac.team",
            ),
        ),
        migrations.AddIndex(
            model_name="webhook",
            index=models.Index(fields=["team"], name="webhooks_webhook_team_idx"),
        ),
    ]
