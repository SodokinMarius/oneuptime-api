import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("status_pages", "0001_initial"),
        ("rbac", "0002_resource_policy"),
    ]

    operations = [
        migrations.AddField(
            model_name="statuspage",
            name="team",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="status_pages",
                to="rbac.team",
            ),
        ),
        migrations.AddIndex(
            model_name="statuspage",
            index=models.Index(fields=["team"], name="status_pages_statuspage_team_idx"),
        ),
    ]
