import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("monitoring", "0001_initial"),
        ("rbac", "0002_resource_policy"),
    ]

    operations = [
        migrations.AddField(
            model_name="monitor",
            name="team",
            field=models.ForeignKey(
                blank=True,
                help_text="NULL = visible to all project members; set = team-scoped",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="monitors",
                to="rbac.team",
            ),
        ),
        migrations.AddField(
            model_name="monitorgroup",
            name="team",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="monitor_groups",
                to="rbac.team",
            ),
        ),
        migrations.AddIndex(
            model_name="monitor",
            index=models.Index(fields=["team"], name="monitoring_monitor_team_idx"),
        ),
        migrations.AddIndex(
            model_name="monitorgroup",
            index=models.Index(fields=["team"], name="monitoring_monitorgroup_team_idx"),
        ),
    ]
