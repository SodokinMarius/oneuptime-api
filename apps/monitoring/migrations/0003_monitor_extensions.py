# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("monitoring", "0002_add_team"),
    ]

    operations = [
        migrations.AddField(
            model_name="monitor",
            name="steps",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Ordered HTTP steps for multi_step_api and journey monitors.",
            ),
        ),
        migrations.AlterField(
            model_name="monitor",
            name="type",
            field=models.CharField(
                choices=[
                    ("api", "API / HTTP"),
                    ("website", "Website"),
                    ("ping", "Ping (ICMP)"),
                    ("tcp", "TCP Port"),
                    ("udp", "UDP Port"),
                    ("dns", "DNS"),
                    ("ssl", "SSL Certificate"),
                    ("multi_step_api", "Multi-step API"),
                    ("journey", "User Journey"),
                    ("heartbeat", "Heartbeat"),
                ],
                default="api",
                max_length=20,
            ),
        ),
    ]
