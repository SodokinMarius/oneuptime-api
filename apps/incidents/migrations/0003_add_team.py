import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("incidents", "0002_initial"),
        ("rbac", "0002_resource_policy"),
    ]

    operations = [
        migrations.AddField(
            model_name="incident",
            name="team",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="incidents",
                to="rbac.team",
            ),
        ),
        migrations.AddIndex(
            model_name="incident",
            index=models.Index(fields=["team"], name="incidents_incident_team_idx"),
        ),
    ]
