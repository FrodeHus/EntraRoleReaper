using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Data.Migrations
{
    /// <inheritdoc />
    public partial class v01 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ResourceActions_Activities_ActivityId",
                table: "ResourceActions");

            migrationBuilder.DropForeignKey(
                name: "FK_ResourceActions_ActivityProperties_ActivityPropertyId",
                table: "ResourceActions");

            migrationBuilder.DropForeignKey(
                name: "FK_ResourceActions_PermissionSets_PermissionSetId",
                table: "ResourceActions");

            migrationBuilder.DropIndex(
                name: "IX_ResourceActions_ActivityId",
                table: "ResourceActions");

            migrationBuilder.DropIndex(
                name: "IX_ResourceActions_ActivityPropertyId",
                table: "ResourceActions");

            migrationBuilder.DropIndex(
                name: "IX_ResourceActions_PermissionSetId",
                table: "ResourceActions");

            migrationBuilder.DropColumn(
                name: "ActivityId",
                table: "ResourceActions");

            migrationBuilder.DropColumn(
                name: "ActivityPropertyId",
                table: "ResourceActions");

            migrationBuilder.DropColumn(
                name: "PermissionSetId",
                table: "ResourceActions");

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

            migrationBuilder.CreateTable(
                name: "ActivityResourceAction",
                columns: table => new
                {
                    MappedActivitiesId = table.Column<Guid>(type: "TEXT", nullable: false),
                    MappedResourceActionsId = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivityResourceAction", x => new { x.MappedActivitiesId, x.MappedResourceActionsId });
                    table.ForeignKey(
                        name: "FK_ActivityResourceAction_Activities_MappedActivitiesId",
                        column: x => x.MappedActivitiesId,
                        principalTable: "Activities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ActivityResourceAction_ResourceActions_MappedResourceActionsId",
                        column: x => x.MappedResourceActionsId,
                        principalTable: "ResourceActions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PermissionSetResourceAction",
                columns: table => new
                {
                    PermissionSetsId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ResourceActionsId = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PermissionSetResourceAction", x => new { x.PermissionSetsId, x.ResourceActionsId });
                    table.ForeignKey(
                        name: "FK_PermissionSetResourceAction_PermissionSets_PermissionSetsId",
                        column: x => x.PermissionSetsId,
                        principalTable: "PermissionSets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PermissionSetResourceAction_ResourceActions_ResourceActionsId",
                        column: x => x.ResourceActionsId,
                        principalTable: "ResourceActions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ActivityPropertyResourceAction_MappedResourceActionsId",
                table: "ActivityPropertyResourceAction",
                column: "MappedResourceActionsId");

            migrationBuilder.CreateIndex(
                name: "IX_ActivityResourceAction_MappedResourceActionsId",
                table: "ActivityResourceAction",
                column: "MappedResourceActionsId");

            migrationBuilder.CreateIndex(
                name: "IX_PermissionSetResourceAction_ResourceActionsId",
                table: "PermissionSetResourceAction",
                column: "ResourceActionsId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ActivityPropertyResourceAction");

            migrationBuilder.DropTable(
                name: "ActivityResourceAction");

            migrationBuilder.DropTable(
                name: "PermissionSetResourceAction");

            migrationBuilder.AddColumn<Guid>(
                name: "ActivityId",
                table: "ResourceActions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ActivityPropertyId",
                table: "ResourceActions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PermissionSetId",
                table: "ResourceActions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ResourceActions_ActivityId",
                table: "ResourceActions",
                column: "ActivityId");

            migrationBuilder.CreateIndex(
                name: "IX_ResourceActions_ActivityPropertyId",
                table: "ResourceActions",
                column: "ActivityPropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_ResourceActions_PermissionSetId",
                table: "ResourceActions",
                column: "PermissionSetId");

            migrationBuilder.AddForeignKey(
                name: "FK_ResourceActions_Activities_ActivityId",
                table: "ResourceActions",
                column: "ActivityId",
                principalTable: "Activities",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ResourceActions_ActivityProperties_ActivityPropertyId",
                table: "ResourceActions",
                column: "ActivityPropertyId",
                principalTable: "ActivityProperties",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ResourceActions_PermissionSets_PermissionSetId",
                table: "ResourceActions",
                column: "PermissionSetId",
                principalTable: "PermissionSets",
                principalColumn: "Id");
        }
    }
}
