# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("maintenance", "0003_add_team"),
    ]

    operations = [
        migrations.AddField(
            model_name="scheduledmaintenance",
            name="recurrence_frequency",
            field=models.CharField(
                choices=[
                    ("none", "None"),
                    ("daily", "Daily"),
                    ("weekly", "Weekly"),
                    ("monthly", "Monthly"),
                ],
                default="none",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="scheduledmaintenance",
            name="recurrence_interval",
            field=models.PositiveSmallIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="scheduledmaintenance",
            name="recurrence_weekdays",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="scheduledmaintenance",
            name="recurrence_until",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="scheduledmaintenance",
            name="series_id",
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
    ]
