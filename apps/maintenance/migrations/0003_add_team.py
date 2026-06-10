import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("maintenance", "0002_initial"),
        ("rbac", "0002_resource_policy"),
    ]

    operations = [
        migrations.AddField(
            model_name="scheduledmaintenance",
            name="team",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="scheduled_maintenances",
                to="rbac.team",
            ),
        ),
        migrations.AddIndex(
            model_name="scheduledmaintenance",
            index=models.Index(
                fields=["team"], name="maintenance_scheduledmaintenance_team_idx"
            ),
        ),
    ]
