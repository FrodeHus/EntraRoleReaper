using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Data.Migrations
{
    /// <inheritdoc />
    public partial class v04 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ActivityPropertyResourceAction");

            migrationBuilder.DropTable(
                name: "ActivityProperties");

            migrationBuilder.CreateTable(
                name: "TargetResources",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ResourceType = table.Column<string>(type: "TEXT", nullable: false),
                    DisplayName = table.Column<string>(type: "TEXT", nullable: true),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    ActivityId = table.Column<Guid>(type: "TEXT", nullable: true),
                    CreatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    DeletedUtc = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TargetResources", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TargetResources_Activities_ActivityId",
                        column: x => x.ActivityId,
                        principalTable: "Activities",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "TargetResourceProperties",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    PropertyName = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    IsSensitive = table.Column<bool>(type: "INTEGER", nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 255, nullable: true),
                    TargetResourceId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    DeletedUtc = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TargetResourceProperties", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TargetResourceProperties_TargetResources_TargetResourceId",
                        column: x => x.TargetResourceId,
                        principalTable: "TargetResources",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ResourceActionTargetResourceProperty",
                columns: table => new
                {
                    MappedResourceActionsId = table.Column<Guid>(type: "TEXT", nullable: false),
                    MappedTargetResourcePropertiesId = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResourceActionTargetResourceProperty", x => new { x.MappedResourceActionsId, x.MappedTargetResourcePropertiesId });
                    table.ForeignKey(
                        name: "FK_ResourceActionTargetResourceProperty_ResourceActions_MappedResourceActionsId",
                        column: x => x.MappedResourceActionsId,
                        principalTable: "ResourceActions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ResourceActionTargetResourceProperty_TargetResourceProperties_MappedTargetResourcePropertiesId",
                        column: x => x.MappedTargetResourcePropertiesId,
                        principalTable: "TargetResourceProperties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ResourceActionTargetResourceProperty_MappedTargetResourcePropertiesId",
                table: "ResourceActionTargetResourceProperty",
                column: "MappedTargetResourcePropertiesId");

            migrationBuilder.CreateIndex(
                name: "IX_TargetResourceProperties_TargetResourceId",
                table: "TargetResourceProperties",
                column: "TargetResourceId");

            migrationBuilder.CreateIndex(
                name: "IX_TargetResources_ActivityId",
                table: "TargetResources",
                column: "ActivityId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ResourceActionTargetResourceProperty");

            migrationBuilder.DropTable(
                name: "TargetResourceProperties");

            migrationBuilder.DropTable(
                name: "TargetResources");

            migrationBuilder.CreateTable(
                name: "ActivityProperties",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ActivityId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DeletedUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 255, nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivityProperties", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ActivityProperties_Activities_ActivityId",
                        column: x => x.ActivityId,
                        principalTable: "Activities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ActivityPropertyResourceAction",
                columns: table => new
                {
                    MappedActivityPropertiesId = table.Column<Guid>(type: "TEXT", nullable: false),
                    MappedResourceActionsId = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivityPropertyResourceAction", x => new { x.MappedActivityPropertiesId, x.MappedResourceActionsId });
                    table.ForeignKey(
                        name: "FK_ActivityPropertyResourceAction_ActivityProperties_MappedActivityPropertiesId",
                        column: x => x.MappedActivityPropertiesId,
                        principalTable: "ActivityProperties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ActivityPropertyResourceAction_ResourceActions_MappedResourceActionsId",
                        column: x => x.MappedResourceActionsId,
                        principalTable: "ResourceActions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ActivityProperties_ActivityId",
                table: "ActivityProperties",
                column: "ActivityId");

            migrationBuilder.CreateIndex(
                name: "IX_ActivityPropertyResourceAction_MappedResourceActionsId",
                table: "ActivityPropertyResourceAction",
                column: "MappedResourceActionsId");
        }
    }
}
